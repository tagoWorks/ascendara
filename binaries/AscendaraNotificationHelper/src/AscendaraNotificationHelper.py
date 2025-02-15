# ==============================================================================
# Ascendara Notification Helper
# ==============================================================================
# A command-line tool for handling Ascendara notifications
# Read more about the Notification Helper Tool here:
# https://ascendara.app/docs/developer/notification-helper






import sys
import os
import argparse
import logging
from typing import Literal
from PyQt6.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, 
    QVBoxLayout, QHBoxLayout, QGraphicsOpacityEffect
)
from PyQt6.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve
from PyQt6.QtGui import QColor, QPainter, QPainterPath, QIcon, QPixmap

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath("./src")
    return os.path.join(base_path, relative_path)

# Define all available themes
ThemeType = Literal["light", "dark", "blue", "purple", "emerald", "rose", "cyberpunk", "sunset", "forest", "midnight", "amber", "ocean"]

# Theme color mappings based on tailwind config
THEME_COLORS = {
    "light": {
        "bg": "255 255 255",      # --color-background
        "fg": "15 23 42",         # --color-foreground
        "border": "226 232 240"   # --color-border
    },
    "dark": {
        "bg": "15 23 42",         # --color-background
        "fg": "241 245 249",      # --color-foreground
        "border": "51 65 85"      # --color-border
    },
    "blue": {
        "bg": "30 41 59",         # --color-background
        "fg": "241 245 249",      # --color-foreground
        "border": "51 65 85"      # --color-border
    },
    "purple": {
        "bg": "88 28 135",        # --color-background
        "fg": "237 233 254",      # --color-foreground
        "border": "147 51 234"    # --color-border
    },
    "emerald": {
        "bg": "6 78 59",          # --color-background
        "fg": "209 250 229",      # --color-foreground
        "border": "16 185 129"    # --color-border
    },
    "rose": {
        "bg": "159 18 57",        # --color-background
        "fg": "255 228 230",      # --color-foreground
        "border": "244 63 94"     # --color-border
    },
    "cyberpunk": {
        "bg": "17 24 39",         # --color-background
        "fg": "236 72 153",       # --color-foreground
        "border": "244 114 182"   # --color-border
    },
    "sunset": {
        "bg": "124 45 18",        # --color-background
        "fg": "254 215 170",      # --color-foreground
        "border": "251 146 60"    # --color-border
    },
    "forest": {
        "bg": "20 83 45",         # --color-background
        "fg": "187 247 208",      # --color-foreground
        "border": "34 197 94"     # --color-border
    },
    "midnight": {
        "bg": "30 41 59",         # --color-background
        "fg": "241 245 249",      # --color-foreground
        "border": "51 65 85"      # --color-border
    },
    "amber": {
        "bg": "120 53 15",        # --color-background
        "fg": "254 243 199",      # --color-foreground
        "border": "245 158 11"    # --color-border
    },
    "ocean": {
        "bg": "12 74 110",        # --color-background
        "fg": "186 230 253",      # --color-foreground
        "border": "14 165 233"    # --color-border
    }
}

class NotificationWindow(QWidget):
    def __init__(self, theme: ThemeType, title: str, message: str):
        super().__init__()
        logger.info(f"Initializing notification with theme: {theme}")
        
        # Get theme colors
        theme_colors = THEME_COLORS[theme]
        self.bg_color = QColor(*[int(x) for x in theme_colors["bg"].split()])
        self.fg_color = QColor(*[int(x) for x in theme_colors["fg"].split()])
        self.border_color = QColor(*[int(x) for x in theme_colors["border"].split()])
        logger.debug(f"Theme colors loaded: bg={self.bg_color.name()}, fg={self.fg_color.name()}, border={self.border_color.name()}")
        
        # Configure window
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool | Qt.WindowType.WindowStaysOnTopHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # Set window size and position
        self.window_width = 400
        self.window_height = 150
        screen = QApplication.primaryScreen().geometry()
        self.x_position = screen.width() - self.window_width - 24  # Consistent 24px margin from screen edge
        self.y_position = screen.height() - self.window_height - 24  # Consistent 24px margin from screen edge
        self.setGeometry(self.x_position, self.y_position, self.window_width, self.window_height)
        logger.debug(f"Window positioned at: {self.x_position}, {self.y_position}")
        
        # Create layout
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 16, 20, 16)  # More balanced margins
        layout.setSpacing(8)  # Consistent spacing between elements
        
        # Create header layout with icon
        header_layout = QHBoxLayout()
        header_layout.setSpacing(12)  # Slightly increased spacing between icon and title
        
        # App icon label
        icon_label = QLabel()
        icon_label.setFixedSize(24, 24)
        
        # Load and set the icon
        icon_path = get_resource_path("ascendara.ico")
        logger.debug(f"Attempting to load icon from: {icon_path}")
        
        if os.path.exists(icon_path):
            logger.debug(f"Loading icon from: {icon_path}")
            pixmap = QPixmap(icon_path)
            if not pixmap.isNull():
                # Scale the pixmap to fit the label while maintaining aspect ratio
                scaled_pixmap = pixmap.scaled(
                    24, 24,
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation
                )
                icon_label.setPixmap(scaled_pixmap)
                # Set window icon too
                self.setWindowIcon(QIcon(pixmap))
                logger.debug("Successfully loaded and set icon")
            else:
                logger.error("Failed to load icon pixmap")
                self._set_fallback_icon(icon_label)
        else:
            logger.warning(f"Icon not found at: {icon_path}, using fallback")
            self._set_fallback_icon(icon_label)
        
        header_layout.addWidget(icon_label)
        
        # Title label
        title_label = QLabel(title)
        title_label.setStyleSheet(f"""
            QLabel {{
                color: {self.fg_color.name()};
                font-family: 'Segoe UI';
                font-size: 16px;
                font-weight: bold;
            }}
        """)
        header_layout.addWidget(title_label)
        
        # Add stretch to push close button to right
        header_layout.addStretch()
        
        # Close button
        close_button = QPushButton("×")
        close_button.setFixedSize(24, 24)
        close_button.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.border_color.name()};
                color: {self.fg_color.name()};
                border: none;
                border-radius: 12px;
                font-family: 'Segoe UI';
                font-size: 16px;
                font-weight: bold;
                padding: 0;
                padding-bottom: 4px;
                line-height: 24px;
                text-align: center;
            }}
            QPushButton:hover {{
                background-color: {self.fg_color.name()};
                color: {self.bg_color.name()};
            }}
        """)
        close_button.clicked.connect(self.close_notification)
        header_layout.addWidget(close_button)
        
        # Add header to main layout
        layout.addLayout(header_layout)
        
        # Message label
        message_label = QLabel(message)
        message_label.setWordWrap(True)
        message_label.setStyleSheet(f"""
            QLabel {{
                color: {self.fg_color.name()};
                font-family: 'Segoe UI';
                font-size: 13px;
            }}
        """)
        layout.addWidget(message_label)
        
        # Add stretch to push footer to bottom
        layout.addStretch()
        
        # Create footer layout
        footer_layout = QHBoxLayout()
        footer_layout.addStretch()
        
        # Add Ascendara label
        ascendara_label = QLabel("Ascendara")
        ascendara_label.setStyleSheet(f"""
            QLabel {{
                color: {self.border_color.name()};
                font-family: 'Segoe UI';
                font-size: 11px;
                font-style: italic;
            }}
        """)
        footer_layout.addWidget(ascendara_label)
        
        # Add footer to main layout
        layout.addLayout(footer_layout)
        
        # Set layout
        self.setLayout(layout)
        
        # Setup fade animations
        self.opacity_effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.opacity_effect)
        self.opacity_effect.setOpacity(0)
        
        # Start fade in animation
        self.fade_in_animation = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.fade_in_animation.setDuration(250)
        self.fade_in_animation.setStartValue(0.0)
        self.fade_in_animation.setEndValue(1.0)
        self.fade_in_animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.fade_in_animation.start()
        logger.debug("Started fade-in animation")
        
        # Schedule fade out
        QTimer.singleShot(4000, self.close_notification)
        logger.debug("Scheduled fade-out")
        
        # Show window
        self.show()
        logger.debug("Window shown")
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Create rounded rectangle path
        path = QPainterPath()
        path.addRoundedRect(0, 0, self.width(), self.height(), 15, 15)
        
        # Draw background
        painter.setPen(Qt.PenStyle.NoPen)
        painter.fillPath(path, self.bg_color)
        
        # Draw border
        painter.setPen(self.border_color)
        painter.drawPath(path)
    
    def close_notification(self):
        if hasattr(self, 'fade_out_animation'):
            return
            
        logger.info("Starting fade-out animation")
        self.fade_out_animation = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.fade_out_animation.setDuration(250)
        self.fade_out_animation.setStartValue(1.0)
        self.fade_out_animation.setEndValue(0.0)
        self.fade_out_animation.setEasingCurve(QEasingCurve.Type.InCubic)
        self.fade_out_animation.finished.connect(self.cleanup)
        self.fade_out_animation.start()
    
    def cleanup(self):
        logger.info("Cleanup: closing window and quitting application")
        self.close()
        QApplication.instance().quit()
    
    def _set_fallback_icon(self, label):
        """Set fallback 'A' icon when the icon file cannot be loaded"""
        label.setText("A")
        label.setStyleSheet(f"""
            QLabel {{
                background-color: {self.border_color.name()};
                color: {self.fg_color.name()};
                border-radius: 12px;
                font-family: 'Segoe UI';
                font-size: 14px;
                font-weight: bold;
                text-align: center;
                line-height: 24px;
            }}
        """)

def main():
    parser = argparse.ArgumentParser(description='Show a notification with the specified theme')
    parser.add_argument('--theme', type=str, default='dark', help='Theme to use for the notification')
    parser.add_argument('--title', type=str, default='Notification', help='Title of the notification')
    parser.add_argument('--message', type=str, default='This is a notification', help='Message to display')
    args = parser.parse_args()
    
    logger.info(f"Starting notification helper with args: {args}")
    
    app = QApplication(sys.argv)
    window = NotificationWindow(args.theme, args.title, args.message)
    sys.exit(app.exec())

if __name__ == "__main__":
    main()