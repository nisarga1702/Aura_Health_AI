"""
xResNet1D Architecture for 12-Lead ECG Classification (PTB-XL Dataset)
======================================================================
PyTorch implementation of 1D ResNet (xResNet1D) for raw 12-lead ECG signals.
Target Classes (SCP-ECG 5 Superclasses):
  - NORM : Normal Sinus Rhythm
  - MI   : Myocardial Infarction (Ischemia / Infarct)
  - STTC : ST/T-Segment Abnormalities
  - CD   : Conduction Disturbances (LBBB, RBBB, AV Block)
  - HYP  : Left/Right Ventricular Hypertrophy
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock1D(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size=7, stride=1, padding=3):
        super(ConvBlock1D, self).__init__()
        self.conv = nn.Conv1d(in_channels, out_channels, kernel_size=kernel_size, stride=stride, padding=padding, bias=False)
        self.bn = nn.BatchNorm1d(out_channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))


class ResBlock1D(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1):
        super(ResBlock1D, self).__init__()
        self.conv1 = nn.Conv1d(in_channels, out_channels, kernel_size=7, stride=stride, padding=3, bias=False)
        self.bn1 = nn.BatchNorm1d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv1d(out_channels, out_channels, kernel_size=7, stride=1, padding=3, bias=False)
        self.bn2 = nn.BatchNorm1d(out_channels)

        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv1d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm1d(out_channels)
            )

    def forward(self, x):
        residual = self.shortcut(x)
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += residual
        return self.relu(out)


class xResNet1D(nn.Module):
    def __init__(self, in_channels=12, num_classes=5, base_filters=64):
        super(xResNet1D, self).__init__()
        
        # Stem Convolution for 12-lead ECGs
        self.stem = nn.Sequential(
            nn.Conv1d(in_channels, base_filters, kernel_size=15, stride=2, padding=7, bias=False),
            nn.BatchNorm1d(base_filters),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=3, stride=2, padding=1)
        )

        # Residual Layers
        self.layer1 = self._make_layer(base_filters, base_filters, blocks=2, stride=1)
        self.layer2 = self._make_layer(base_filters, base_filters * 2, blocks=2, stride=2)
        self.layer3 = self._make_layer(base_filters * 2, base_filters * 4, blocks=2, stride=2)
        self.layer4 = self._make_layer(base_filters * 4, base_filters * 8, blocks=2, stride=2)

        # Adaptive Global Pooling & Classification Head
        self.global_pool = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(base_filters * 8, num_classes)
        )

    def _make_layer(self, in_channels, out_channels, blocks, stride):
        layers = []
        layers.append(ResBlock1D(in_channels, out_channels, stride=stride))
        for _ in range(1, blocks):
            layers.append(ResBlock1D(out_channels, out_channels, stride=1))
        return nn.Sequential(*layers)

    def forward(self, x):
        # x shape: (batch_size, 12, sequence_length)
        x = self.stem(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.global_pool(x)
        x = x.squeeze(-1)
        out = self.fc(x)
        return out


def get_xresnet1d_model(in_channels=12, num_classes=5):
    return xResNet1D(in_channels=in_channels, num_classes=num_classes)


if __name__ == "__main__":
    model = get_xresnet1d_model()
    dummy_input = torch.randn(4, 12, 1000) # 4 samples, 12 leads, 1000 time steps (100Hz 10s)
    output = model(dummy_input)
    print("xResNet1D Model Created Successfully!")
    print("Input shape:", dummy_input.shape)
    print("Output shape:", output.shape)
