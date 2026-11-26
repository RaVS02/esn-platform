"""Angielskie wersje szablonów i instrukcji redakcji: te same id co polskie oryginały, podmiany tekstu trafiają w kod widgetów."""
import json
import os
import shutil
import subprocess

import pytest

STATIC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
NODE = shutil.which("node")

SCRIPT = r"""
const fs=require('fs'),vm=require('vm');
function load(lang){
  const w={ESNI18n:{lang:()=>lang}}; w.window=w;
  for (const f of ['knowledge-templates.js','knowledge-templates-en.js','knowledge-guide.js','knowledge-guide-en.js'])
    vm.runInNewContext(fs.readFileSync(process.argv[1]+'/'+f,'utf8'), w);
  return w;
}
const pl=load('pl'), en=load('en');
const out={};
out.widgetIds=pl.ESNKnowledgeTemplates.map(t=>t.id);
out.missingRep=[];
for (const t of pl.ESNKnowledgeTemplates){ const o=pl.ESNKnowledgeL10n._W.en[t.id]; if(!o){out.missingRep.push('noentry:'+t.id);continue;}
  for (const p of o.rep) if (t.code.indexOf(p[0])<0) out.missingRep.push(t.id+':'+p[0]); }
const ew=en.ESNKnowledgeL10n.widgets();
out.enWidgetNames=ew.map(t=>t.name);
out.plIsOriginal=pl.ESNKnowledgeL10n.widgets()===pl.ESNKnowledgeTemplates;
out.docIds={}; out.docEnChanged=[];
const pd=pl.ESNKnowledgeDocTemplates, ed=en.ESNKnowledgeL10n.docs();
for (const k of Object.keys(pd)) for (const t of pd[k]) { const e=ed[k].find(x=>x.id===t.id); if(!e||e.body===t.body||e.name===t.name) out.docEnChanged.push(k+':'+t.id); }
out.guidePl=pl.ESNKnowledgeGuide.sections.map(s=>s.id); out.guideEn=pl.ESNKnowledgeGuide.byLang.en.map(s=>s.id);
const G=pl.ESNKnowledgeGuide; out.guideShape=G.sections.map((s,i)=>{const e=G.byLang.en[i];return [!!s.md===!!e.md,!!s.intro===!!e.intro,(s.examples||[]).length===(e.examples||[]).length,!!s.templates===!!e.templates,!!s.outro===!!e.outro].every(Boolean)});
const pol=/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
out.polishLeft=[];
for (const t of ew) if (pol.test(t.name+t.desc+t.code.replace(/[^\n]*Wi-Fi[^\n]*/g,''))) out.polishLeft.push('w:'+t.id);
for (const k of Object.keys(ed)) for (const t of ed[k]) if (pol.test(t.name+t.desc+t.body)) out.polishLeft.push(k+':'+t.id);
for (const s of G.byLang.en) if (pol.test(JSON.stringify(s))) out.polishLeft.push('g:'+s.id);
console.log(JSON.stringify(out));
"""


@pytest.mark.skipif(not NODE, reason="brak node")
def test_english_templates_and_guide_match_originals():
    r = subprocess.run([NODE, "-e", SCRIPT, STATIC], capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stderr
    o = json.loads(r.stdout)
    assert o["missingRep"] == [], o["missingRep"]
    assert o["plIsOriginal"] is True
    assert o["docEnChanged"] == [], o["docEnChanged"]
    assert o["guidePl"] == o["guideEn"]
    assert all(o["guideShape"]), o["guideShape"]
    assert "Voltage divider" in o["enWidgetNames"]
    assert o["polishLeft"] == [], o["polishLeft"]
