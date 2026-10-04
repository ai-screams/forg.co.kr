"""Load a stage script whose file name starts with a digit (`02c-parse-listing.py`)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

ETL_DIR = Path(__file__).resolve().parent.parent


def load_stage(file: str) -> ModuleType:
    name = "stage_" + file.removesuffix(".py").replace("-", "_")
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, ETL_DIR / file)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module
