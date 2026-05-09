from fastapi import APIRouter

from app.schemas.specs import SpecsInput, SpecsParseResponse, TierScores
from app.services.spec_parser import parse_specs
from app.services.tier_classifier import classify_hardware_tier

router = APIRouter()


@router.post("/parse", response_model=SpecsParseResponse)
async def parse_hardware_specs(input: SpecsInput):
    specs, method = await parse_specs(input.raw_text)

    # Classify hardware tier using multi-factor scoring
    tier_info = classify_hardware_tier(
        gpu=specs.gpu,
        vram_mb=specs.vram_mb,
        cpu=specs.cpu,
        ram_gb=specs.ram_gb,
        cpu_cores=specs.cpu_cores,
        cpu_speed_ghz=specs.cpu_speed_ghz,
    )

    # Normalize scores to a 0-5 scale for consistent frontend display
    # Raw maxima: vram=30, gpu_gen=25, cpu=25, ram=20, overall=100
    return SpecsParseResponse(
        specs=specs,
        raw_text=input.raw_text,
        parse_method=method,
        tier=tier_info["tier"],
        tier_scores=TierScores(
            vram=round(tier_info["vram_score"] / 30 * 5, 1),
            cpu=round(tier_info["cpu_score"] / 25 * 5, 1),
            ram=round(tier_info["ram_score"] / 20 * 5, 1),
            gpu_gen=round(tier_info["gpu_gen_score"] / 25 * 5, 1),
            overall=round(tier_info["overall_score"] / 100 * 5, 1),
        ),
    )
