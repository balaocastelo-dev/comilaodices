#!/usr/bin/env python3
"""
Doces Komilão — captação de leads (padarias, lanchonetes, bares, mercearias...)
Fonte: OpenStreetMap via Overpass API (dados abertos, licença ODbL — sem scraping do Google).
Só usa a biblioteca padrão do Python 3.8+.

Uso:
  python captar_leads.py                       # Campinas e região (RMC)
  python captar_leads.py --cidades Campinas Valinhos
  python captar_leads.py --saida ./saida

Gera em --saida:
  leads.json   -> importar no painel admin (Leads > Importar)
  leads.csv    -> abrir no Excel
  painel_leads.html -> painel com mapa, filtros e botões de WhatsApp
"""
import argparse, csv, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from datetime import datetime

CIDADES_RMC = [
    "Campinas", "Valinhos", "Vinhedo", "Paulínia", "Sumaré", "Hortolândia", "Indaiatuba",
    "Jaguariúna", "Americana", "Nova Odessa", "Santa Bárbara d'Oeste", "Monte Mor", "Itatiba",
    "Pedreira", "Holambra", "Artur Nogueira", "Cosmópolis", "Engenheiro Coelho",
    "Santo Antônio de Posse", "Morungaba",
]

# (chave OSM, valor) -> (categoria Komilão, peso)
CATEGORIAS = {
    ("shop", "confectionery"): ("bomboniere", 35),
    ("shop", "bakery"): ("padaria", 30),
    ("shop", "convenience"): ("mercearia", 30),
    ("shop", "general"): ("mercearia", 30),
    ("shop", "deli"): ("mercearia", 25),
    ("shop", "kiosk"): ("banca", 25),
    ("shop", "pastry"): ("confeitaria", 20),
    ("amenity", "fast_food"): ("lanchonete", 22),
    ("amenity", "bar"): ("bar", 22),
    ("amenity", "pub"): ("bar", 22),
    ("amenity", "biergarten"): ("bar", 18),
    ("amenity", "cafe"): ("cafeteria", 15),
    ("amenity", "ice_cream"): ("sorveteria", 15),
}

# Redes/franquias e mercados grandes que o cliente NÃO quer
REDES_BLOQUEADAS = [
    "assai", "atacadao", "carrefour", "pao de acucar", "supermercado extra", "mini extra", "extra hiper",
    "dia supermercado", "supermercado dia", "sonda", "tenda atacado", "makro", "sams club", "sam's club",
    "roldao", "spani", "savegnago", "enxuto", "covabra", "good bom", "goodbom", "pague menos", "oba hortifruti",
    "hirota", "st marche", "walmart", "nagumo", "semar", "dalben", "mcdonald", "burger king", "subway", "habib",
    "bob's", "starbucks", "kfc", "giraffas", "spoleto", "china in box", "outback", "popeyes", "jeronimo",
    "madero", "coco bambu", "domino's", "pizza hut", "cacau show", "kopenhagen", "brasil cacau", "am/pm",
    "am pm", "ampm", "br mania", "shell select", "oxxo", "boticario", "havanna", "casa bauducco", "rei do mate",
    "fran's cafe", "the coffee", "bauducco", "chiquinho sorvetes", "sodie", "lindt", "multicoisas", "casa do pao de queijo", "kalunga",
]

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
USER_AGENT = "KomilaoDoces-LeadFinder/1.0 (contato comercial Campinas)"


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower()


def consulta_cidade(cidade):
    filtros = []
    for (k, v) in CATEGORIAS:
        filtros.append(f'nwr(area.c)["{k}"="{v}"];')
    q = f"""[out:json][timeout:120];
area["ISO3166-2"="BR-SP"]->.sp;
rel(area.sp)["boundary"="administrative"]["admin_level"="8"]["name"="{cidade}"];
map_to_area->.c;
({''.join(filtros)});
out center tags;"""
    body = urllib.parse.urlencode({"data": q}).encode()
    ultimo = None
    for tentativa in range(2):
        for url in OVERPASS_URLS:
            try:
                req = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=75) as r:
                    txt = r.read().decode("utf-8")
                if not txt.lstrip().startswith("{"):
                    raise RuntimeError("servidor ocupado (resposta não-JSON)")
                dados = json.loads(txt)
                aviso = dados.get("remark", "")
                if aviso and ("error" in aviso.lower() or "timed out" in aviso.lower()):
                    raise RuntimeError("servidor: " + aviso[:120])
                return dados["elements"]
            except Exception as e:  # tenta o próximo servidor
                ultimo = e
        time.sleep(6)
    raise RuntimeError(f"Falha ao consultar {cidade}: {ultimo}")


def normaliza_fone(bruto):
    """Retorna (e164_sem_mais, eh_celular). Assume DDD 19 se vier sem DDD."""
    if not bruto:
        return None, False
    primeiro = re.split(r"[;,/]", bruto)[0]
    d = re.sub(r"\D", "", primeiro)
    if d.startswith("0"):
        d = d.lstrip("0")
    if d.startswith("55") and len(d) in (12, 13):
        d = d[2:]
    if len(d) in (8, 9):
        d = "19" + d
    if len(d) not in (10, 11):
        return None, False
    celular = len(d) == 11 and d[2] == "9"
    return "55" + d, celular


def eh_rede(tags):
    if tags.get("brand:wikidata") or tags.get("brand:wikipedia"):
        return True
    alvo = sem_acento(" ".join([tags.get("name", ""), tags.get("brand", ""), tags.get("operator", "")])) + " "
    return any(re.search(r"(^|\W)" + re.escape(r) + r"(\W|$)", alvo) for r in REDES_BLOQUEADAS)


def monta_lead(el, cidade_consulta):
    t = el.get("tags", {})
    nome = (t.get("name") or "").strip()
    if not nome:
        return None, "sem nome"
    cat, peso = None, 0
    for (k, v), (c, p) in CATEGORIAS.items():
        if t.get(k) == v and p > peso:
            cat, peso = c, p
    if not cat:
        return None, "categoria"
    if t.get("shop") == "supermarket" or eh_rede(t):
        return None, "rede/mercado grande"
    if el["type"] == "node":
        lat, lon = el.get("lat"), el.get("lon")
    else:
        lat, lon = el.get("center", {}).get("lat"), el.get("center", {}).get("lon")

    fones = [t.get(k) for k in ("contact:whatsapp", "mobile", "contact:mobile", "phone", "contact:phone") if t.get(k)]
    whatsapp, telefone = None, None
    for f in fones:
        n, cel = normaliza_fone(f)
        if n and cel and not whatsapp:
            whatsapp = n
        if n and not telefone:
            telefone = n
    rua = t.get("addr:street", "")
    num = t.get("addr:housenumber", "")
    endereco = f"{rua}, {num}".strip(", ") if rua else ""
    site = t.get("website") or t.get("contact:website") or ""
    insta = t.get("contact:instagram") or ""
    if "instagram.com" in site and not insta:
        insta, site = site, ""

    score = peso
    score += 25 if whatsapp else (12 if telefone else 0)
    score += 5 if endereco else 0
    score += 5 if t.get("opening_hours") else 0
    score += 5 if (site or insta) else 0
    score += 5 if cidade_consulta == "Campinas" else 0
    score += 5 if t.get("addr:suburb") else 0

    return {
        "fonte": "osm",
        "fonte_id": f"{el['type']}/{el['id']}",
        "nome": nome,
        "categoria": cat,
        "endereco": endereco,
        "bairro": t.get("addr:suburb") or t.get("addr:neighbourhood") or "",
        "cidade": cidade_consulta,
        "cep": t.get("addr:postcode", ""),
        "lat": lat,
        "lon": lon,
        "telefone": telefone,
        "whatsapp": whatsapp,
        "site": site,
        "instagram": insta,
        "horario": t.get("opening_hours", ""),
        "score": min(score, 100),
        "dados": {"osm_tags": {k: v for k, v in t.items() if not k.startswith("source")}},
    }, None


def main():
    ap = argparse.ArgumentParser(description="Captação de leads Doces Komilão (OpenStreetMap)")
    ap.add_argument("--cidades", nargs="*", default=CIDADES_RMC)
    ap.add_argument("--saida", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "saida"))
    ap.add_argument("--pausa", type=float, default=3.0, help="segundos entre cidades (respeitar o servidor)")
    ap.add_argument("--atualizar", action="store_true", help="ignora o cache e consulta tudo de novo")
    a = ap.parse_args()
    os.makedirs(a.saida, exist_ok=True)

    leads, vistos, descartes, falhas = [], set(), {}, []
    for i, cidade in enumerate(a.cidades, 1):
        print(f"[{i}/{len(a.cidades)}] {cidade}...", end=" ", flush=True)
        cache = os.path.join(a.saida, "cache", sem_acento(cidade).replace(" ", "_").replace("'", "") + ".json")
        if os.path.exists(cache) and not a.atualizar:
            with open(cache, encoding="utf-8") as f:
                els = json.load(f)
            consultou = False
        else:
            try:
                els = consulta_cidade(cidade)
            except Exception as e:
                print(f"ERRO: {e} — rode de novo para tentar só as que faltam")
                falhas.append(cidade)
                continue
            if els:  # resultado vazio pode ser falha silenciosa do servidor: não guarda em cache
                os.makedirs(os.path.dirname(cache), exist_ok=True)
                with open(cache, "w", encoding="utf-8") as f:
                    json.dump(els, f, ensure_ascii=False)
            consultou = True
        novos = 0
        for el in els:
            lead, motivo = monta_lead(el, cidade)
            if not lead:
                descartes[motivo] = descartes.get(motivo, 0) + 1
                continue
            if lead["fonte_id"] in vistos:
                continue
            vistos.add(lead["fonte_id"])
            leads.append(lead)
            novos += 1
        print(f"{novos} leads" + ("" if consultou else " (cache)"))
        if consultou:
            time.sleep(a.pausa)

    leads.sort(key=lambda x: (-x["score"], x["cidade"], x["nome"]))
    meta = {
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "cidades": a.cidades,
        "total": len(leads),
        "descartes": descartes,
        "cidades_com_falha": falhas,
        "fonte": "© colaboradores do OpenStreetMap (ODbL)",
    }
    with open(os.path.join(a.saida, "leads.json"), "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=1)
    campos = ["nome", "categoria", "cidade", "bairro", "endereco", "cep", "whatsapp", "telefone", "site",
              "instagram", "horario", "score", "lat", "lon", "fonte_id"]
    with open(os.path.join(a.saida, "leads.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=";", extrasaction="ignore")
        w.writeheader()
        w.writerows(leads)

    from gerar_painel import gerar
    painel = gerar(leads, meta, a.saida)
    print(f"\nTotal: {len(leads)} leads | descartados: {descartes}")
    if falhas:
        print(f"ATENÇÃO: faltaram {len(falhas)} cidades ({', '.join(falhas)}). Rode de novo para completar.")
    print(f"Painel: {painel}")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
