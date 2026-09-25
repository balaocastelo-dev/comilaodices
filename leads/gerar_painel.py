"""Gera painel_leads.html autocontido (dados embutidos, mapa Leaflet + OpenStreetMap)."""
import base64, io, json, os, sys

LOGO_PADRAO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logo.png")


def _logo_b64():
    try:
        with open(LOGO_PADRAO, "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode()
    except OSError:
        return ""


def gerar(leads, meta, saida):
    html = TEMPLATE.replace("__LOGO__", _logo_b64())
    html = html.replace("__DADOS__", json.dumps(leads, ensure_ascii=False).replace("</", "<\\/"))
    html = html.replace("__META__", json.dumps(meta, ensure_ascii=False).replace("</", "<\\/"))
    caminho = os.path.join(saida, "painel_leads.html")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(html)
    return caminho


TEMPLATE = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Leads Komilão</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
:root{--amarelo:#FFBB12;--vermelho:#E53935;--tinta:#2b1d0e;--fundo:#fffaf0;--card:#fff;--borda:#f1e3c4;--suave:#7a6a55;
--padaria:#F97316;--mercearia:#22C55E;--lanchonete:#E53935;--bar:#8B5CF6;--bomboniere:#EC4899;--banca:#0EA5E9;--cafeteria:#92400E;--sorveteria:#06B6D4;--confeitaria:#DB2777}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--tinta:#fdf3e1;--fundo:#1c1710;--card:#2a2218;--borda:#3d3222;--suave:#c4b394}}
:root[data-theme="dark"]{--tinta:#fdf3e1;--fundo:#1c1710;--card:#2a2218;--borda:#3d3222;--suave:#c4b394}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;background:var(--fundo);color:var(--tinta)}
header{background:var(--amarelo);color:#2b1d0e;padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
header img{width:56px;height:56px;border-radius:50%;background:#fff}
header h1{margin:0;font-size:22px;font-weight:800;letter-spacing:.2px}
header .sub{font-size:13px;opacity:.8}
main{padding:16px;max-width:1500px;margin:0 auto}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px}
.card{background:var(--card);border:1px solid var(--borda);border-radius:14px;padding:12px 14px}
.card b{display:block;font-size:26px;font-variant-numeric:tabular-nums}
.card span{font-size:12px;color:var(--suave);text-transform:uppercase;letter-spacing:.4px}
.filtros{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--card);border:1px solid var(--borda);border-radius:14px;padding:10px;margin-bottom:12px}
.filtros input,.filtros select{padding:8px 10px;border:1px solid var(--borda);border-radius:10px;background:var(--fundo);color:var(--tinta);font-size:14px}
.filtros input[type=search]{flex:1;min-width:180px}
.filtros label{font-size:13px;display:flex;gap:6px;align-items:center}
.btn{border:0;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:13px}
.btn.am{background:var(--amarelo);color:#2b1d0e}.btn.vm{background:var(--vermelho);color:#fff}.btn.cl{background:transparent;border:1px solid var(--borda);color:var(--tinta)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.chip{border:1px solid var(--borda);background:var(--card);border-radius:999px;padding:5px 10px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--tinta)}
.chip i{width:10px;height:10px;border-radius:50%;display:inline-block}
.chip.off{opacity:.4}
.grade{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:12px}
@media (max-width:980px){.grade{grid-template-columns:1fr}}
#mapa{height:640px;border-radius:14px;border:1px solid var(--borda)}
@media (max-width:980px){#mapa{height:380px}}
.tabela{background:var(--card);border:1px solid var(--borda);border-radius:14px;overflow:auto;max-height:640px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{position:sticky;top:0;background:var(--card);text-align:left;padding:8px;border-bottom:2px solid var(--borda);cursor:pointer;white-space:nowrap}
td{padding:7px 8px;border-bottom:1px solid var(--borda);vertical-align:top}
tr:hover td{background:rgba(255,187,18,.10)}
.nome{font-weight:700}
.muted{color:var(--suave);font-size:12px}
.tag{display:inline-block;padding:2px 8px;border-radius:999px;color:#fff;font-size:11px;font-weight:700}
.score{font-weight:800;font-variant-numeric:tabular-nums}
.acoes a{display:inline-block;margin:0 4px 4px 0;padding:4px 8px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700}
.wa{background:#22C55E;color:#fff}.mp{background:var(--fundo);color:var(--tinta);border:1px solid var(--borda)}
footer{font-size:12px;color:var(--suave);padding:16px;text-align:center}
.aviso{background:#fff4d6;color:#5b4308;border:1px solid #f5d27a;border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:12px}
</style>
</head>
<body>
<header>
  <img src="__LOGO__" alt="">
  <div><h1>Painel de Leads — Doces Komilão</h1><div class="sub" id="sub"></div></div>
</header>
<main>
  <div class="cards" id="cards"></div>
  <div class="aviso">💡 Clique em <b>WhatsApp</b> só para contatos individuais. Para campanhas, importe o <b>leads.json</b> no painel admin: as mensagens entram na fila e só saem depois que você aprovar (com limite diário, intervalo entre envios e opção SAIR).</div>
  <div class="filtros">
    <input type="search" id="busca" placeholder="Buscar nome, bairro, endereço...">
    <select id="cidade"><option value="">Todas as cidades</option></select>
    <label>Score mín. <input type="range" id="score" min="0" max="100" value="0" style="width:110px"><b id="scoreV">0</b></label>
    <label><input type="checkbox" id="soWa"> Só com WhatsApp</label>
    <label><input type="checkbox" id="soFone"> Só com telefone</label>
    <button class="btn cl" id="limpar">Limpar</button>
    <button class="btn am" id="csv">Exportar CSV</button>
    <button class="btn vm" id="json">Exportar JSON p/ admin</button>
  </div>
  <div class="chips" id="chips"></div>
  <div class="grade">
    <div id="mapa"></div>
    <div class="tabela"><table><thead><tr>
      <th data-k="score">Score</th><th data-k="nome">Estabelecimento</th><th data-k="cidade">Cidade</th><th>Contato</th><th>Ações</th>
    </tr></thead><tbody id="tb"></tbody></table></div>
  </div>
</main>
<footer id="rod"></footer>
<script>
const LEADS=__DADOS__, META=__META__;
const COR={padaria:'var(--padaria)',mercearia:'var(--mercearia)',lanchonete:'var(--lanchonete)',bar:'var(--bar)',bomboniere:'var(--bomboniere)',banca:'var(--banca)',cafeteria:'var(--cafeteria)',sorveteria:'var(--sorveteria)',confeitaria:'var(--confeitaria)'};
const HEX={};const cs=getComputedStyle(document.documentElement);for(const k in COR)HEX[k]=cs.getPropertyValue('--'+k).trim()||'#999';
const NOMECAT={padaria:'Padaria',mercearia:'Mercearia',lanchonete:'Lanchonete',bar:'Bar',bomboniere:'Bomboniere',banca:'Banca',cafeteria:'Cafeteria',sorveteria:'Sorveteria',confeitaria:'Confeitaria'};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fone=n=>{if(!n)return'';const d=n.replace(/^55/,'');return d.length===11?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`};
const catsOn=new Set(Object.keys(NOMECAT));let ord={k:'score',d:-1};
$('sub').textContent=`${META.total} estabelecimentos · ${META.cidades.length} cidades · gerado em ${META.gerado_em}`;
$('rod').textContent=`Dados: ${META.fonte}. Mercados grandes e redes/franquias foram excluídos automaticamente.`;
[...new Set(LEADS.map(l=>l.cidade))].sort((a,b)=>a.localeCompare(b,'pt')).forEach(c=>{const o=document.createElement('option');o.value=o.textContent=c;$('cidade').appendChild(o)});
const cont={};LEADS.forEach(l=>cont[l.categoria]=(cont[l.categoria]||0)+1);
Object.keys(NOMECAT).filter(k=>cont[k]).sort((a,b)=>cont[b]-cont[a]).forEach(k=>{const b=document.createElement('button');b.className='chip';b.innerHTML=`<i style="background:${HEX[k]}"></i>${NOMECAT[k]} <b>${cont[k]}</b>`;b.onclick=()=>{catsOn.has(k)?catsOn.delete(k):catsOn.add(k);b.classList.toggle('off');render()};$('chips').appendChild(b)});
const mapa=L.map('mapa').setView([-22.905,-47.06],11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(mapa);
const camada=L.layerGroup().addTo(mapa);
function filtrados(){const q=$('busca').value.trim().toLowerCase(),c=$('cidade').value,s=+$('score').value,wa=$('soWa').checked,tf=$('soFone').checked;
 return LEADS.filter(l=>catsOn.has(l.categoria)&&(!c||l.cidade===c)&&l.score>=s&&(!wa||l.whatsapp)&&(!tf||l.telefone)&&(!q||[l.nome,l.bairro,l.endereco,l.cidade].join(' ').toLowerCase().includes(q)))
  .sort((a,b)=>{const x=a[ord.k],y=b[ord.k];return(typeof x==='number'?x-y:String(x).localeCompare(String(y),'pt'))*ord.d})}
function msg(l){return encodeURIComponent(`Olá, ${l.nome}! Aqui é da Doces Komilão 😋 Distribuímos doces e salgadinhos com preço de atacado em ${l.cidade}. Posso te mandar nossa tabela?`)}
function render(){const F=filtrados();
 const cards=[['Leads filtrados',F.length],['Com WhatsApp',F.filter(l=>l.whatsapp).length],['Com telefone',F.filter(l=>l.telefone).length],['Score ≥ 60',F.filter(l=>l.score>=60).length],['Cidades',new Set(F.map(l=>l.cidade)).size]];
 $('cards').innerHTML=cards.map(([t,v])=>`<div class="card"><b>${v}</b><span>${t}</span></div>`).join('');
 $('tb').innerHTML=F.slice(0,1500).map((l,i)=>`<tr data-i="${LEADS.indexOf(l)}"><td class="score">${l.score}</td>
  <td><div class="nome">${esc(l.nome)}</div><span class="tag" style="background:${HEX[l.categoria]}">${NOMECAT[l.categoria]}</span> <span class="muted">${esc([l.endereco,l.bairro].filter(Boolean).join(' · '))}</span>${l.horario?`<div class="muted">🕒 ${esc(l.horario)}</div>`:''}</td>
  <td>${esc(l.cidade)}</td>
  <td>${l.whatsapp?`<div>📱 ${fone(l.whatsapp)}</div>`:''}${l.telefone&&l.telefone!==l.whatsapp?`<div class="muted">☎ ${fone(l.telefone)}</div>`:''}${l.site?`<div><a class="muted" href="${esc(l.site)}" target="_blank" rel="noopener">site</a></div>`:''}${l.instagram?`<div><a class="muted" href="${esc(l.instagram)}" target="_blank" rel="noopener">instagram</a></div>`:''}</td>
  <td class="acoes">${l.whatsapp?`<a class="wa" target="_blank" rel="noopener" href="https://wa.me/${l.whatsapp}?text=${msg(l)}">WhatsApp</a>`:''}<a class="mp" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=18/${l.lat}/${l.lon}">Mapa</a></td></tr>`).join('');
 camada.clearLayers();F.forEach(l=>{if(l.lat==null)return;L.circleMarker([l.lat,l.lon],{radius:l.whatsapp?7:5,color:'#fff',weight:1,fillColor:HEX[l.categoria],fillOpacity:.9})
  .bindPopup(`<b>${esc(l.nome)}</b><br>${NOMECAT[l.categoria]} · ${esc(l.cidade)}<br>${esc(l.endereco)}<br>${l.whatsapp?'📱 '+fone(l.whatsapp):l.telefone?'☎ '+fone(l.telefone):'sem telefone'}<br>Score ${l.score}`).addTo(camada)});
}
function baixar(nome,conteudo,tipo){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([conteudo],{type:tipo}));a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
$('csv').onclick=()=>{const F=filtrados(),c=['nome','categoria','cidade','bairro','endereco','cep','whatsapp','telefone','site','instagram','horario','score'];
 baixar('leads_komilao.csv','﻿'+[c.join(';')].concat(F.map(l=>c.map(k=>'"'+String(l[k]??'').replace(/"/g,'""')+'"').join(';'))).join('\n'),'text/csv')};
$('json').onclick=()=>baixar('leads_komilao.json',JSON.stringify(filtrados(),null,1),'application/json');
$('limpar').onclick=()=>{$('busca').value='';$('cidade').value='';$('score').value=0;$('scoreV').textContent=0;$('soWa').checked=$('soFone').checked=false;render()};
['busca','cidade','soWa','soFone'].forEach(id=>$(id).addEventListener('input',render));
$('score').addEventListener('input',e=>{$('scoreV').textContent=e.target.value;render()});
document.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{const k=th.dataset.k;ord={k,d:ord.k===k?-ord.d:(k==='score'?-1:1)};render()});
$('tb').addEventListener('click',e=>{if(e.target.closest('a'))return;const tr=e.target.closest('tr');if(!tr)return;const l=LEADS[+tr.dataset.i];if(l.lat!=null)mapa.setView([l.lat,l.lon],17)});
render();
</script>
</body>
</html>"""

if __name__ == "__main__":
    pasta = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "saida")
    with open(os.path.join(pasta, "leads.json"), encoding="utf-8") as f:
        dados = json.load(f)
    print(gerar(dados, {"gerado_em": "-", "cidades": sorted({d["cidade"] for d in dados}), "total": len(dados),
                        "fonte": "© colaboradores do OpenStreetMap (ODbL)"}, pasta))
