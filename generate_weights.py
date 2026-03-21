import torch
import torch.nn as nn

class InceptionBlock(nn.Module):
    def __init__(self, in_channels, out_channels_1, out_channels_2, out_channels_3, out_channels_4):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels_1, 1)
        self.conv2 = nn.Conv2d(in_channels, out_channels_2, 3, padding=1)
        self.conv3_1 = nn.Conv2d(in_channels, out_channels_3, 1)
        self.conv3_2 = nn.Conv2d(out_channels_3, out_channels_3, 3, padding=1)
        self.pool = nn.MaxPool2d(3, stride=1, padding=1)
        self.conv4 = nn.Conv2d(in_channels, out_channels_4, 1)

    def forward(self, x):
        return torch.cat([self.conv1(x), self.conv2(x), self.conv3_2(self.conv3_1(x)), self.conv4(self.pool(x))], dim=1)

class MesoInception4(nn.Module):
    def __init__(self):
        super().__init__()
        self.b1 = InceptionBlock(3, 1, 4, 4, 2)
        self.b2 = InceptionBlock(11, 2, 4, 4, 2)
        self.conv3 = nn.Conv2d(12, 16, 5, padding=2)
        self.conv4 = nn.Conv2d(16, 16, 5, padding=2)
        self.bn2 = nn.BatchNorm2d(12)
        self.bn3 = nn.BatchNorm2d(16)
        self.bn4 = nn.BatchNorm2d(16)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(16 * 16 * 16, 16)
        self.fc2 = nn.Linear(16, 1)
        self.dropout = nn.Dropout(0.5)
        self.relu = nn.LeakyReLU(0.1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = self.pool(self.relu(self.b1(x)))
        x = self.pool(self.relu(self.bn2(self.b2(x))))
        x = self.pool(self.relu(self.bn3(self.conv3(x))))
        x = self.pool(self.relu(self.bn4(self.conv4(x))))
        x = x.view(x.size(0), -1)
        x = self.dropout(self.relu(self.fc1(x)))
        return self.sigmoid(self.fc2(x))

model = MesoInception4()
output_path = r'backend\ml\models\weights\mesonet.pth'
torch.save(model.state_dict(), output_path)
print(f'Weights saved to {output_path}')
