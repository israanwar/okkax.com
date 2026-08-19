"""Root Pytest Configuration and Path Setup."""

from pathlib import Path
import sys

# Ensure backend root is always in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
