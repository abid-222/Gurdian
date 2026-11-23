import os, pathlib, sys, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
os.environ["GUARDIAN_DB"] = tempfile.mktemp(suffix=".db"); os.environ["GUARDIAN_TOKEN"] = "t0k"
os.environ["GUARDIAN_WATCHLIST_USER"] = tempfile.mktemp(suffix=".conf")   # tests never touch data/
sys.path.insert(0, str(ROOT / "backend"))
