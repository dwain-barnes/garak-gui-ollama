import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import httpx
import uuid
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Data directory for scan results
DATA_DIR = Path("./data")
DATA_DIR.mkdir(exist_ok=True)
SCANS_FILE = DATA_DIR / "scans.json"

# Initialize scans storage
if not SCANS_FILE.exists():
    SCANS_FILE.write_text("[]")


class OllamaClient:
    """Client for interacting with Ollama API"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """List all available models from Ollama"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return data.get("models", [])
        except Exception as e:
            logger.error(f"Error listing Ollama models: {e}")
            return []
    
    async def check_connection(self) -> bool:
        """Check if Ollama is running"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/tags", timeout=2.0)
                return response.status_code == 200
        except:
            return False


class GarakRunner:
    """Runner for Garak scans"""

    @staticmethod
    def get_available_probes() -> List[Dict[str, Any]]:
        """Get list of available Garak probes"""
        try:
            from garak import _plugins

            probe_list: List[Dict[str, Any]] = []

            # enumerate_plugins returns (path: str, is_default: bool)
            for path, is_default in _plugins.enumerate_plugins("probes"):
                try:
                    # Optional: get nicer metadata for display
                    info = {}
                    try:
                        info = _plugins.plugin_info(path)
                    except Exception:
                        # If plugin_info fails we still want to return something
                        info = {}

                    # path is an opaque plugin identifier; keep it as-is for CLI
                    # e.g. "probes.promptinject.AutoDAN" or similar
                    description = (
                        info.get("description")
                        or info.get("goal")
                        or f"Probe: {path}"
                    )

                    probe_list.append(
                        {
                            # Full plugin path â€“ use this when calling garak
                            "id": path,
                            # Keep these fields so existing frontend code that uses
                            # probe.name / probe.module keeps working
                            "name": path,
                            "module": path,
                            "description": description,
                            "active_by_default": bool(is_default),
                            # Optional extra metadata for nicer UI
                            "tags": info.get("tags") or [],
                        }
                    )
                except Exception as e:
                    logger.warning(f"Could not load probe {path}: {e}")

            return probe_list

        except Exception as e:
            logger.error(f"Error getting probes: {e}")
            return []
    
    @staticmethod
    def get_available_detectors() -> List[Dict[str, Any]]:
        """Get list of available Garak detectors"""
        try:
            from garak import _plugins

            detector_list: List[Dict[str, Any]] = []

            for path, is_default in _plugins.enumerate_plugins("detectors"):
                try:
                    info = {}
                    try:
                        info = _plugins.plugin_info(path)
                    except Exception:
                        info = {}

                    description = (
                        info.get("description")
                        or info.get("goal")
                        or f"Detector: {path}"
                    )

                    detector_list.append(
                        {
                            "id": path,
                            "name": path,
                            "module": path,
                            "description": description,
                            "active_by_default": bool(is_default),
                            "tags": info.get("tags") or [],
                        }
                    )
                except Exception as e:
                    logger.warning(f"Could not load detector {path}: {e}")

            return detector_list

        except Exception as e:
            logger.error(f"Error getting detectors: {e}")
            return []

    
    @staticmethod
    async def run_scan(
        model_name: str,
        probes: List[str],
        detectors: Optional[List[str]],
        websocket: WebSocket,
        scan_id: str
    ) -> Optional[Dict[str, Any]]:
        """Run a Garak scan with the specified configuration and return results"""
        results = None  # Initialize results at function scope
        
        try:
            await websocket.send_json({
                "type": "status",
                "message": f"Starting scan on model: {model_name}",
                "progress": 0
            })
            
            # Import garak
            import garak
            from garak import cli
            
            def normalize_plugin_name(name: str, category: str) -> str:
                """
                Convert things like:
                  - 'probes.dan.DAN_Jailbreak'
                  - 'garak.probes.dan.DAN_Jailbreak'
                  - 'detectors.dan.DANJailbreak'
                into CLI-friendly forms like 'dan.DAN_Jailbreak'.
                """
                # full Python path, e.g. 'garak.probes.dan.DAN_Jailbreak'
                full_prefix = f"garak.{category}."
                if name.startswith(full_prefix):
                    return name[len(full_prefix):]

                # plugin path from enumerate_plugins, e.g. 'probes.dan.DAN_Jailbreak'
                short_prefix = f"{category}."
                if name.startswith(short_prefix):
                    return name[len(short_prefix):]

                # already CLI-style (e.g. 'dan.DAN_Jailbreak' or 'dan')
                return name

            # Prepare Garak arguments
            probe_args = []
            for probe in probes:
                cli_name = normalize_plugin_name(probe, "probes")
                probe_args.extend(["--probes", cli_name])

            detector_args = []
            if detectors:
                for detector in detectors:
                    cli_name = normalize_plugin_name(detector, "detectors")
                    detector_args.extend(["--detectors", cli_name])
            
             # Create output directory for this scan (under backend/data/<scan_id>)
            output_dir = DATA_DIR / scan_id
            # make sure all parent dirs exist
            output_dir.mkdir(parents=True, exist_ok=True)

            # IMPORTANT: use an *absolute* path for report_prefix so garak
            # doesn't stick it under ~/.local/share/garak/garak_runs
            report_prefix = (output_dir.resolve() / "report")

            args = [
                "--model_type", "ollama",
                "--model_name", model_name,
                *probe_args,
                *detector_args,
                "--report_prefix", str(report_prefix),
            ]
            
            await websocket.send_json({
                "type": "status",
                "message": "Initializing Garak...",
                "progress": 10
            })
            
            # Run Garak scan in a separate thread to avoid blocking
            loop = asyncio.get_event_loop()
            
            def run_garak():
                try:
                    cli.main(args)
                    return True
                except Exception as e:
                    logger.error(f"Garak scan error: {e}")
                    return False
            
            await websocket.send_json({
                "type": "status",
                "message": "Running scan...",
                "progress": 20
            })
            
            # Run the scan
            success = await loop.run_in_executor(None, run_garak)
            
            if success:
                await websocket.send_json({
                    "type": "status",
                    "message": "Scan completed successfully!",
                    "progress": 100
                })
                
                # Parse results
                results = GarakRunner.parse_results(output_dir, scan_id)
                
                await websocket.send_json({
                    "type": "complete",
                    "scan_id": scan_id,
                    "results": results
                })
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": "Scan failed. Check logs for details."
                })
                
        except Exception as e:
            logger.error(f"Error running scan: {e}")
            await websocket.send_json({
                "type": "error",
                "message": f"Scan error: {str(e)}"
            })
        
        return results  # Return results so they can be saved
    
    @staticmethod
    def parse_results(output_dir: Path, scan_id: str) -> Dict[str, Any]:
        """Parse Garak output files"""
        results = {
            "summary": {},
            "details": [],
            "report_html": None,
            "report_path": None
        }
        
        # Look for report files
        for file in output_dir.glob("report*.jsonl"):
            try:
                with open(file, 'r') as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line)
                            results["details"].append(data)
            except Exception as e:
                logger.error(f"Error parsing {file}: {e}")
        
        # Look for HTML report
        html_files = list(output_dir.glob("report*.html"))
        if html_files:
            results["report_html"] = html_files[0].name
            results["report_path"] = f"/api/scans/{scan_id}/report"
        
        return results


# Pydantic models
class ScanRequest(BaseModel):
    model_name: str
    probes: List[str]
    detectors: Optional[List[str]] = None
    description: Optional[str] = None


class ScanRecord(BaseModel):
    id: str
    timestamp: str
    model_name: str
    probes: List[str]
    detectors: Optional[List[str]]
    description: Optional[str]
    status: str
    results: Optional[Dict[str, Any]] = None


# FastAPI app
app = FastAPI(title="Garak GUI", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
ollama_client = OllamaClient()
garak_runner = GarakRunner()

# Active WebSocket connections
active_connections: List[WebSocket] = []


def load_scans() -> List[Dict]:
    """Load scan history from file"""
    try:
        with open(SCANS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []


def save_scan(scan: Dict):
    """Save a scan record"""
    scans = load_scans()
    scans.append(scan)
    with open(SCANS_FILE, 'w') as f:
        json.dump(scans, f, indent=2)


@app.get("/")
async def root():
    return {"message": "Garak GUI API", "status": "running"}


@app.get("/api/health")
async def health_check():
    """Check health of the API and Ollama connection"""
    ollama_status = await ollama_client.check_connection()
    return {
        "api": "healthy",
        "ollama": "connected" if ollama_status else "disconnected"
    }


@app.get("/api/models")
async def list_models():
    """List available Ollama models"""
    models = await ollama_client.list_models()
    return {"models": models}


@app.get("/api/probes")
async def list_probes():
    """List available Garak probes"""
    probes = garak_runner.get_available_probes()
    return {"probes": probes}


@app.get("/api/detectors")
async def list_detectors():
    """List available Garak detectors"""
    detectors = garak_runner.get_available_detectors()
    return {"detectors": detectors}


@app.get("/api/scans")
async def list_scans():
    """List all scan history"""
    scans = load_scans()
    return {"scans": scans}


@app.get("/api/scans/{scan_id}")
async def get_scan(scan_id: str):
    """Get details of a specific scan"""
    scans = load_scans()
    scan = next((s for s in scans if s["id"] == scan_id), None)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@app.get("/api/scans/{scan_id}/report")
async def get_scan_report(scan_id: str):
    """Get the HTML report for a specific scan"""
    # Find the scan directory
    scan_dir = DATA_DIR / scan_id
    if not scan_dir.exists():
        raise HTTPException(status_code=404, detail="Scan directory not found")
    
    # Find HTML report
    html_files = list(scan_dir.glob("report*.html"))
    if not html_files:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return FileResponse(
        html_files[0],
        media_type="text/html",
        filename=f"scan_{scan_id}_report.html"
    )


@app.websocket("/ws/scan")
async def websocket_scan(websocket: WebSocket):
    """WebSocket endpoint for running scans"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        # Receive scan request
        data = await websocket.receive_json()
        
        logger.info(f"Received scan request for model: {data.get('model_name')}")
        logger.info(f"Probes: {data.get('probes')}")
        logger.info(f"Detectors: {data.get('detectors')}")
        
        scan_id = str(uuid.uuid4())
        scan_record = {
            "id": scan_id,
            "timestamp": datetime.now().isoformat(),
            "model_name": data["model_name"],
            "probes": data["probes"],
            "detectors": data.get("detectors"),
            "description": data.get("description"),
            "status": "running"
        }
        
        save_scan(scan_record)
        
        # Run the scan and get results
        scan_results = await garak_runner.run_scan(
            model_name=data["model_name"],
            probes=data["probes"],
            detectors=data.get("detectors"),
            websocket=websocket,
            scan_id=scan_id
        )
        
        # Update scan status and save results
        scans = load_scans()
        for scan in scans:
            if scan["id"] == scan_id:
                scan["status"] = "completed"
                if scan_results:  # Save results if they exist
                    scan["results"] = scan_results
                    logger.info(f"Saved results for scan {scan_id}: {scan_results.get('report_path')}")
                break
        with open(SCANS_FILE, 'w') as f:
            json.dump(scans, f, indent=2)
        
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
