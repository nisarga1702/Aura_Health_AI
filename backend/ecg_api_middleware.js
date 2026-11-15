/**
 * Enhanced ECG API Middleware and Utilities
 * Provides request validation, response formatting, caching, and error handling
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ========================================
// RESPONSE FORMATTER
// ========================================

class ResponseFormatter {
  static success(data, statusCode = 200) {
    return {
      statusCode,
      body: {
        success: true,
        data,
        timestamp: new Date().toISOString()
      }
    };
  }

  static error(message, statusCode = 500, details = null) {
    return {
      statusCode,
      body: {
        success: false,
        error: message,
        ...(details && { details }),
        timestamp: new Date().toISOString()
      }
    };
  }

  static validationError(errors) {
    return this.error('Validation failed', 400, { errors });
  }

  static serverError(message, error) {
    return this.error(message, 500, {
      errorMessage: error?.message,
      errorStack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}

// ========================================
// REQUEST VALIDATOR
// ========================================

class RequestValidator {
  static validateBase64Image(imageString) {
    if (!imageString) {
      return { valid: false, error: 'No image data provided' };
    }

    // Remove data URI prefix if present
    let base64Data = imageString;
    if (imageString.includes(',')) {
      base64Data = imageString.split(',')[1];
    }

    try {
      // Test decode
      Buffer.from(base64Data, 'base64');
      
      // Check size (max 10MB)
      const sizeInMB = Buffer.byteLength(base64Data, 'base64') / (1024 * 1024);
      if (sizeInMB > 10) {
        return { valid: false, error: 'Image exceeds 10MB size limit' };
      }

      return { valid: true };
    } catch (e) {
      return { valid: false, error: 'Invalid base64 encoding' };
    }
  }

  static validatePatientData(patientData) {
    if (!patientData) {
      return { valid: true, data: {} };
    }

    const errors = [];

    if (patientData.age && (isNaN(patientData.age) || patientData.age < 0 || patientData.age > 150)) {
      errors.push('Age must be a number between 0-150');
    }

    if (patientData.gender && !['Male', 'Female', 'Other'].includes(patientData.gender)) {
      errors.push('Gender must be Male, Female, or Other');
    }

    if (patientData.name && patientData.name.length > 255) {
      errors.push('Name must not exceed 255 characters');
    }

    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { errors })
    };
  }

  static validateECGAnalysisRequest(body) {
    const errors = [];

    if (!body.image) {
      errors.push('image field is required');
    } else {
      const imageValidation = this.validateBase64Image(body.image);
      if (!imageValidation.valid) {
        errors.push(`image: ${imageValidation.error}`);
      }
    }

    if (body.patientData) {
      const patientValidation = this.validatePatientData(body.patientData);
      if (!patientValidation.valid) {
        errors.push(...(patientValidation.errors || []));
      }
    }

    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { errors })
    };
  }
}

// ========================================
// RESPONSE CACHE
// ========================================

class ECGAnalysisCache {
  constructor(maxSize = 100, ttl = 3600000) { // 1 hour TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  generateKey(image, patientData = {}) {
    const hash = crypto
      .createHash('sha256')
      .update(image + JSON.stringify(patientData))
      .digest('hex');
    return hash;
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key, data) {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

// ========================================
// RATE LIMITER
// ========================================

class RateLimiter {
  constructor(maxRequests = 30, windowMs = 60000) { // 30 requests per minute
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(clientId) {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];

    // Remove old requests outside the window
    const recentRequests = clientRequests.filter(time => now - time < this.windowMs);

    if (recentRequests.length >= this.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((recentRequests[0] + this.windowMs - now) / 1000)
      };
    }

    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);

    return { allowed: true };
  }

  getRemainingRequests(clientId) {
    const clientRequests = this.requests.get(clientId) || [];
    const now = Date.now();
    const recentRequests = clientRequests.filter(time => now - time < this.windowMs);
    return this.maxRequests - recentRequests.length;
  }
}

// ========================================
// ECG ANALYSIS RESPONSE BUILDER
// ========================================

class ECGResponseBuilder {
  static buildSuccessResponse(analysisResult) {
    return {
      success: true,
      analysis: {
        ecg_type: analysisResult.ecg_type,
        leads: this._formatLeadsData(analysisResult.analysis),
        mi_analysis: analysisResult.analysis.mi_analysis,
        summary: analysisResult.summary,
        risk_assessment: analysisResult.risk_assessment
      },
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        processingTimeMs: analysisResult.processingTime || null
      }
    };
  }

  static buildErrorResponse(error) {
    return {
      success: false,
      error: error.message || 'Analysis failed',
      details: error.details || null,
      timestamp: new Date().toISOString()
    };
  }

  static _formatLeadsData(analysisData) {
    const leadsInfo = {};
    const leads = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

    leads.forEach(lead => {
      if (analysisData[lead]) {
        leadsInfo[lead] = {
          valid: analysisData[lead].valid,
          heartRate: analysisData[lead].bpm,
          hrv: analysisData[lead].hrv,
          qrsWidth: analysisData[lead].qrs_ms,
          stShift: analysisData[lead].st_shift,
          signalQuality: analysisData[lead].noise_level,
          detectedIssues: analysisData[lead].checks
        };
      }
    });

    return leadsInfo;
  }

  static buildRiskSummary(analysisResult) {
    const summary = analysisResult.summary || {};
    const risk = analysisResult.risk_assessment || {};

    return {
      success: true,
      summary: {
        ecgType: analysisResult.ecg_type,
        validLeads: summary.valid_leads,
        averageHeartRate: summary.average_heart_rate,
        miSuspected: summary.mi_suspected || false,
        miSeverity: summary.mi_severity,
        affectedRegions: summary.affected_regions || {}
      },
      risk: {
        score: risk.risk_score,
        category: risk.risk_category,
        riskFactors: risk.risk_factors,
        recommendation: risk.recommendation
      },
      timestamp: new Date().toISOString()
    };
  }
}

// ========================================
// ASYNC TIMEOUT WRAPPER
// ========================================

function withTimeout(promise, timeoutMs = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

// ========================================
// ASYNC PYTHON EXECUTOR
// ========================================

function executePythonAsync(pythonExecutable, scriptPath, payload, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');

    const process = spawn(pythonExecutable, [scriptPath], {
      cwd: path.dirname(scriptPath),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      process.kill();
      reject(new Error(`Python process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    process.stdin.write(JSON.stringify(payload));
    process.stdin.end();

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    process.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) return;

      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e.message}`));
      }
    });
  });
}

// ========================================
// MIDDLEWARE HELPERS
// ========================================

function getClientId(req) {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function logRequest(req, details = {}) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const clientId = getClientId(req);
  
  console.log(`[${timestamp}] ${method} ${path} - Client: ${clientId}`, details);
}

function logError(req, error, details = {}) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  
  console.error(`[${timestamp}] ERROR ${method} ${path}:`, error.message, details);
}

module.exports = {
  ResponseFormatter,
  RequestValidator,
  ECGAnalysisCache,
  RateLimiter,
  ECGResponseBuilder,
  withTimeout,
  executePythonAsync,
  getClientId,
  logRequest,
  logError
};
