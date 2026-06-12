import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # innovation_dashboard root
DATA_DIR = ROOT / "data" / "alumni"
CLEANED_FLAGS_PATH = Path(os.environ.get("ALUMNI_CLEANED_FLAGS_PATH", DATA_DIR / "cleaned_flags.csv"))
TAXONOMY_DIR = DATA_DIR / "analysis-config"
