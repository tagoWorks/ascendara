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
import subprocess
import atexit

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

# Pre-compute theme colors as QColor objects
THEME_COLORS = {
    "light": {
        "bg": QColor(255, 255, 255),      # --color-background
        "fg": QColor(15, 23, 42),         # --color-foreground
        "border": QColor(226, 232, 240),  # --color-border
    },
    "dark": {
        "bg": QColor(15, 23, 42),         # --color-background
        "fg": QColor(241, 245, 249),      # --color-foreground
        "border": QColor(51, 65, 85),      # --color-border
    },
    "blue": {
        "bg": QColor(30, 41, 59),         # --color-background
        "fg": QColor(241, 245, 249),      # --color-foreground
        "border": QColor(51, 65, 85),      # --color-border
    },
    "purple": {
        "bg": QColor(88, 28, 135),        # --color-background
        "fg": QColor(237, 233, 254),      # --color-foreground
        "border": QColor(147, 51, 234),    # --color-border
    },
    "emerald": {
        "bg": QColor(6, 78, 59),          # --color-background
        "fg": QColor(209, 250, 229),      # --color-foreground
        "border": QColor(16, 185, 129),    # --color-border
    },
    "rose": {
        "bg": QColor(159, 18, 57),        # --color-background
        "fg": QColor(255, 228, 230),      # --color-foreground
        "border": QColor(244, 63, 94),     # --color-border
    },
    "cyberpunk": {
        "bg": QColor(17, 24, 39),         # --color-background
        "fg": QColor(236, 72, 153),       # --color-foreground
        "border": QColor(244, 114, 182),   # --color-border
    },
    "sunset": {
        "bg": QColor(124, 45, 18),        # --color-background
        "fg": QColor(254, 215, 170),      # --color-foreground
        "border": QColor(251, 146, 60),    # --color-border
    },
    "forest": {
        "bg": QColor(20, 83, 45),         # --color-background
        "fg": QColor(187, 247, 208),      # --color-foreground
        "border": QColor(34, 197, 94),     # --color-border
    },
    "midnight": {
        "bg": QColor(30, 41, 59),         # --color-background
        "fg": QColor(241, 245, 249),      # --color-foreground
        "border": QColor(51, 65, 85),      # --color-border
    },
    "amber": {
        "bg": QColor(120, 53, 15),        # --color-background
        "fg": QColor(254, 243, 199),      # --color-foreground
        "border": QColor(245, 158, 11),    # --color-border
    },
    "ocean": {
        "bg": QColor(12, 74, 110),        # --color-background
        "fg": QColor(186, 230, 253),      # --color-foreground
        "border": QColor(14, 165, 233),    # --color-border
    }
}

# Cache for icon pixmap
_icon_pixmap = None

def _launch_crash_reporter_on_exit(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use subprocess.Popen with CREATE_NO_WINDOW flag to hide console
            subprocess.Popen(
                [crash_reporter_path, "notificationhelper", str(error_code), error_message],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")

def launch_crash_reporter(error_code, error_message):
    """Register the crash reporter to launch on exit with the given error details"""
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

class NotificationWindow(QWidget):
    def __init__(self, theme: Literal["light", "dark", "blue", "purple", "emerald", "rose", "cyberpunk", "sunset", "forest", "midnight", "amber", "ocean"], title: str, message: str):
        super().__init__()
        logger.info(f"Initializing notification with theme: {theme}")
        
        # Get pre-computed theme colors
        theme_colors = THEME_COLORS[theme]
        self.bg_color = theme_colors["bg"]
        self.fg_color = theme_colors["fg"]
        self.border_color = theme_colors["border"]
        logger.debug(f"Theme colors loaded: bg={self.bg_color.name()}, fg={self.fg_color.name()}, border={self.border_color.name()}")
        
        # Configure window (combine flags for single operation)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool | Qt.WindowType.WindowStaysOnTopHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # Set window size and position in one operation
        screen = QApplication.primaryScreen().geometry()
        self.setGeometry(
            screen.width() - 474,  # Increased width + margin
            screen.height() - 204, # Increased height + margin
            450,  # Increased width
            180   # Increased height
        )
        logger.debug(f"Window positioned at: {screen.width() - 474}, {screen.height() - 204}")
        
        # Create and configure main layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)  # Increased padding
        layout.setSpacing(12)  # Increased spacing
        
        # Create header with icon and title
        header = QWidget()
        header_layout = QHBoxLayout(header)
        header_layout.setSpacing(14)  # Increased spacing
        header_layout.setContentsMargins(0, 0, 0, 0)
        
        # Load icon (using cached version if available)
        icon_label = QLabel()
        icon_label.setFixedSize(28, 28)  # Slightly larger icon
        self._set_icon(icon_label)
        header_layout.addWidget(icon_label)
        
        # Add title
        title_label = QLabel(title)
        title_label.setStyleSheet(f"color: {self.fg_color.name()}; font-family: 'Segoe UI'; font-size: 18px; font-weight: bold;")  # Larger title
        header_layout.addWidget(title_label)
        header_layout.addStretch()
        
        # Add close button
        close_button = QPushButton("×")
        close_button.setFixedSize(28, 28)  # Larger close button
        close_button.setStyleSheet(
            f"QPushButton {{ background-color: {self.border_color.name()}; color: {self.fg_color.name()}; "
            f"border: none; border-radius: 14px; font-family: 'Segoe UI'; font-size: 18px; font-weight: bold; "
            f"padding: 0; padding-bottom: 4px; line-height: 28px; text-align: center; }} "
            f"QPushButton:hover {{ background-color: {self.fg_color.name()}; color: {self.bg_color.name()}; }}"
        )
        close_button.clicked.connect(self.close_notification)
        header_layout.addWidget(close_button)
        
        layout.addWidget(header)
        
        # Add message
        message_label = QLabel(message)
        message_label.setWordWrap(True)
        message_label.setStyleSheet(f"color: {self.fg_color.name()}; font-family: 'Segoe UI'; font-size: 16px; line-height: 1.4;")  # Increased from 14px to 16px
        layout.addWidget(message_label)
        
        layout.addStretch()
        
        # Add footer
        footer = QWidget()
        footer_layout = QHBoxLayout(footer)
        footer_layout.setContentsMargins(0, 0, 0, 0)
        footer_layout.addStretch()
        
        ascendara_label = QLabel("Ascendara")
        ascendara_label.setStyleSheet(f"color: {self.border_color.name()}; font-family: 'Segoe UI'; font-size: 12px; font-style: italic; letter-spacing: 0.5px;")  # Enhanced footer style
        footer_layout.addWidget(ascendara_label)
        
        layout.addWidget(footer)
        
        # Setup and start fade animation
        self.opacity_effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.opacity_effect)
        self.opacity_effect.setOpacity(0)
        
        self.fade_in_animation = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.fade_in_animation.setDuration(200)  # Reduced from 250ms
        self.fade_in_animation.setStartValue(0.0)
        self.fade_in_animation.setEndValue(1.0)
        self.fade_in_animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.fade_in_animation.start()
        
        # Schedule fade out
        QTimer.singleShot(4000, self.close_notification)
        
        # Show window
        self.show()
        logger.debug("Window shown")

    def _set_icon(self, label):
        global _icon_pixmap
        if _icon_pixmap is None:
            icon_path = get_resource_path("ascendara.ico")
            if os.path.exists(icon_path):
                pixmap = QPixmap(icon_path)
                if not pixmap.isNull():
                    _icon_pixmap = pixmap.scaled(
                        28, 28,
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.SmoothTransformation
                    )
                    logger.debug("Icon loaded and cached")
                else:
                    logger.error("Failed to load icon pixmap")
                    self._set_fallback_icon(label)
                    return
            else:
                logger.warning(f"Icon not found at: {icon_path}, using fallback")
                self._set_fallback_icon(label)
                return
        
        label.setPixmap(_icon_pixmap)
        self.setWindowIcon(QIcon(_icon_pixmap))

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
        self.fade_out_animation.setDuration(200)  # Reduced from 250ms
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
                border-radius: 14px;
                font-family: 'Segoe UI';
                font-size: 16px;
                font-weight: bold;
                text-align: center;
                line-height: 28px;
            }}
        """)

def main():
    parser = argparse.ArgumentParser(description='Show a notification with the specified theme')
    parser.add_argument('--theme', type=str, default='dark', help='Theme to use for the notification')
    parser.add_argument('--title', type=str, default='Notification', help='Title of the notification')
    parser.add_argument('--message', type=str, default='This is a notification', help='Message to display')
    args = parser.parse_args()
    
    logger.info(f"Starting notification helper with args: {args}")
    
    try:
        app = QApplication(sys.argv)
        window = NotificationWindow(args.theme, args.title, args.message)
        sys.exit(app.exec())
    except Exception as e:
        launch_crash_reporter(1, str(e))

if __name__ == "__main__":
    main()