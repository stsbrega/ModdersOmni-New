from app.services.spec_parser import parse_specs_regex


def test_parse_nvidia_gpu():
    text = "NVIDIA GeForce RTX 4070 Ti 12GB GDDR6X"
    specs = parse_specs_regex(text)
    assert specs.gpu is not None
    assert "RTX 4070 Ti" in specs.gpu
    assert specs.vram_mb == 12288


def test_parse_amd_gpu():
    text = "AMD Radeon RX 7900 XTX 24GB"
    specs = parse_specs_regex(text)
    assert specs.gpu is not None
    assert "RX 7900 XTX" in specs.gpu


def test_parse_intel_cpu():
    text = "Intel Core i7-13700K"
    specs = parse_specs_regex(text)
    assert specs.cpu is not None
    assert "i7-13700K" in specs.cpu


def test_parse_amd_cpu():
    text = "AMD Ryzen 7 7800X3D"
    specs = parse_specs_regex(text)
    assert specs.cpu is not None
    assert "7800X3D" in specs.cpu


def test_parse_ram():
    text = "32 GB DDR5 RAM"
    specs = parse_specs_regex(text)
    assert specs.ram_gb == 32


def test_parse_full_system():
    text = """
    GPU: NVIDIA GeForce RTX 3060 Ti
    VRAM: 8 GB GDDR6
    CPU: AMD Ryzen 5 5600X
    RAM: 16 GB DDR4
    """
    specs = parse_specs_regex(text)
    assert specs.gpu is not None
    assert "RTX 3060 Ti" in specs.gpu
    assert specs.vram_mb == 8192
    assert specs.cpu is not None
    assert "5600X" in specs.cpu
    assert specs.ram_gb == 16


def test_parse_ram_system_memory():
    text = "System Memory: 32 GB"
    specs = parse_specs_regex(text)
    assert specs.ram_gb == 32


def test_parse_ram_total_physical():
    text = "Total Physical Memory: 32,651 MB"
    specs = parse_specs_regex(text)
    assert specs.ram_gb == 32


def test_parse_ram_installed_physical():
    text = "Installed Physical Memory (RAM): 64 GB"
    specs = parse_specs_regex(text)
    assert specs.ram_gb == 64


def test_parse_ram_decimal():
    text = "System Memory: 31.9 GB"
    specs = parse_specs_regex(text)
    assert specs.ram_gb == 31


def test_parse_empty_text():
    specs = parse_specs_regex("")
    assert specs.gpu is None
    assert specs.vram_mb is None
    assert specs.cpu is None
    assert specs.ram_gb is None
