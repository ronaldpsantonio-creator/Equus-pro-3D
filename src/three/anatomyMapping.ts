import { StructureRecord, SystemCode } from '../types/proclavet';

export interface Anatomy3DAnchor {
  targetId: string;
  isProxy: boolean;
}

export interface AnchorableSceneItem {
  record: StructureRecord;
  hasMesh: boolean;
  side: 'left' | 'right' | 'center';
}

type SidePreference = 'left' | 'right' | 'center';

function getSideFromRecord(record: StructureRecord): SidePreference {
  if (record.id.endsWith('-i')) return 'left';
  if (record.id.endsWith('-d')) return 'right';
  const lat = (record.lateralidad || '').toLowerCase();
  if (lat.includes('izquierd')) return 'left';
  if (lat.includes('derech')) return 'right';
  return 'center';
}

/**
 * Given a base ID (with or without -i/-d suffix), find an actually mounted mesh ID
 * respecting left/right laterality whenever possible.
 */
function pickMountedVariant(
  candidateBaseOrId: string,
  side: SidePreference,
  items: Record<string, AnchorableSceneItem>,
): string | null {
  const cleanBase = candidateBaseOrId.replace(/-(i|d)$/, '');

  const order: string[] = [];
  if (candidateBaseOrId !== cleanBase) {
    // Explicit suffix provided first
    if (side === 'left') {
      order.push(`${cleanBase}-i`, candidateBaseOrId, cleanBase, `${cleanBase}-d`);
    } else if (side === 'right') {
      order.push(`${cleanBase}-d`, candidateBaseOrId, cleanBase, `${cleanBase}-i`);
    } else {
      order.push(candidateBaseOrId, cleanBase, `${cleanBase}-i`, `${cleanBase}-d`);
    }
  } else if (side === 'left') {
    order.push(`${cleanBase}-i`, cleanBase, `${cleanBase}-d`);
  } else if (side === 'right') {
    order.push(`${cleanBase}-d`, cleanBase, `${cleanBase}-i`);
  } else {
    order.push(cleanBase, `${cleanBase}-i`, `${cleanBase}-d`);
  }

  for (const id of order) {
    if (items[id]?.hasMesh) return id;
  }
  return null;
}

function pickFirstMounted(
  candidates: string[],
  side: SidePreference,
  items: Record<string, AnchorableSceneItem>,
): string | null {
  for (const cand of candidates) {
    const found = pickMountedVariant(cand, side, items);
    if (found) return found;
  }
  return null;
}

const REGION_RULES: Record<
  string,
  (text: string) => string[]
> = {
  // === CARDIOVASCULAR Y LINFÁTICO ===
  'equ.car.cor': () => ['equ.car.cor.001'],
  'equ.car.con': () => ['equ.car.cor.001'],
  'equ.car.pcd': () => ['equ.car.cor.001'],
  'equ.car.vco': () => ['equ.car.cor.001'],
  'equ.car.lor': () => ['equ.car.lor.001'],
  'equ.car.fet': (t) =>
    /umbilical|venoso|cava/.test(t)
      ? ['equ.car.vtr.002', 'equ.car.cor.001']
      : ['equ.car.tpa.005', 'equ.car.cor.001'],
  'equ.car.sdu': () => ['equ.ner.enc.001', 'equ.ske.cra.001'],
  'equ.car.tpa': (t) => {
    if (/abdom|il[ií]ac|renal|mesent[eé]r|cel[ií]ac|lumbar|sacr/.test(t)) {
      return ['equ.car.tpa.009', 'equ.car.tpa.008', 'equ.car.tpa.005'];
    }
    if (/tor[aá]c|intercostal|bronco|esof[aá]g/.test(t)) {
      return ['equ.car.tpa.008', 'equ.car.tpa.005'];
    }
    return ['equ.car.tpa.005', 'equ.car.cor.001'];
  },
  'equ.car.vtr': (t) => {
    if (/craneal|braquiocef|yugular|[aá]cigos|tor[aá]c|intercostal/.test(t)) {
      return ['equ.car.vtr.001', 'equ.car.vtr.002'];
    }
    return ['equ.car.vtr.002', 'equ.car.vtr.001'];
  },
  'equ.car.acc': (t) => {
    if (/subclav|vertebral|costocerv|tor[aá]cic/.test(t)) {
      return ['equ.car.amt.001', 'equ.car.acc.002'];
    }
    return ['equ.car.acc.002', 'equ.car.vcc.001'];
  },
  'equ.car.vcc': () => ['equ.car.vcc.001', 'equ.car.acc.002'],
  'equ.car.amt': () => ['equ.car.amt.001'],
  'equ.car.vmt': () => ['equ.car.amt.001'],
  'equ.car.amp': () => ['equ.car.amp.001'],
  'equ.car.vmp': () => ['equ.car.amp.001'],
  'equ.car.avi': (t) => {
    if (/espl[eé]nic|gastroepipl/.test(t)) return ['equ.car.lor.001', 'equ.car.tpa.009'];
    if (/g[aá]stric/.test(t)) return ['equ.dig.est.001', 'equ.car.tpa.009'];
    if (/hep[aá]tic|porta|c[ií]stic/.test(t)) return ['equ.dig.hig.001', 'equ.car.tpa.009'];
    if (/renal|suprarrenal|testic|ov[aá]ric|uterin/.test(t)) return ['equ.uri.rin.001', 'equ.car.tpa.009'];
    if (/mesent|yeyun|[ií]le|cecal|c[oó]lic|rectal/.test(t)) return ['equ.dig.int.002', 'equ.car.tpa.009'];
    return ['equ.car.tpa.009', 'equ.car.tpa.008'];
  },
  'equ.car.vvi': (t) => {
    if (/espl[eé]nic/.test(t)) return ['equ.car.lor.001', 'equ.car.vtr.002'];
    if (/g[aá]stric/.test(t)) return ['equ.dig.est.001', 'equ.car.vtr.002'];
    if (/porta|hep[aá]tic/.test(t)) return ['equ.dig.hig.001', 'equ.car.vtr.002'];
    if (/renal/.test(t)) return ['equ.uri.rin.001', 'equ.car.vtr.002'];
    if (/mesent|yeyun|[ií]le|cecal|c[oó]lic/.test(t)) return ['equ.dig.int.002', 'equ.car.vtr.002'];
    return ['equ.car.vtr.002', 'equ.dig.hig.001'];
  },
  'equ.car.lco': (t) => {
    if (/quilo|lumbar|intestinal/.test(t)) return ['equ.car.tpa.009', 'equ.car.vtr.002'];
    return ['equ.car.vtr.001', 'equ.car.tpa.008'];
  },
  'equ.car.lin': (t) => {
    if (/parot|mandib|retrofar|bucal|facial/.test(t)) return ['equ.car.acc.002', 'equ.car.vcc.001'];
    if (/cervical/.test(t)) return ['equ.car.vcc.001', 'equ.car.acc.002'];
    if (/axilar|cubital|preescap/.test(t)) return ['equ.car.amt.001'];
    if (/il[ií]ac|inguin|popl[ií]t|femoral|sacr|gl[uú]t|subil/.test(t)) return ['equ.car.amp.001'];
    if (/mediast|traqueobronq|pulmon|tor[aá]c|esternal/.test(t)) return ['equ.res.pul.001', 'equ.car.vtr.001'];
    if (/mesent|cecal|c[oó]lic|g[aá]str|hep[aá]t|espl[eé]n|quilo/.test(t)) return ['equ.dig.int.002', 'equ.car.lor.001'];
    if (/renal/.test(t)) return ['equ.uri.rin.001'];
    return ['equ.car.vtr.001', 'equ.car.cor.001'];
  },

  // === DIGESTIVO ===
  'equ.dig.boc': (t) => {
    if (/lengua|lingual|sublingual/.test(t)) return ['equ.ske.cra.017', 'equ.mus.cab.014'];
    if (/paladar|palatin/.test(t)) return ['equ.ske.cra.014', 'equ.ske.cra.012'];
    if (/mejilla|bucal|par[oó]tid/.test(t)) return ['equ.mus.cab.014', 'equ.ske.cra.012'];
    return ['equ.mus.cab.013', 'equ.ske.cra.012'];
  },
  'equ.dig.den': (t) => {
    if (/inferior|mandibular/.test(t)) return ['equ.ske.cra.017', 'equ.ske.cra.013'];
    if (/incisivo/.test(t)) return ['equ.ske.cra.013', 'equ.ske.cra.012'];
    return ['equ.ske.cra.012', 'equ.ske.cra.017'];
  },
  'equ.dig.fae': () => ['equ.res.lar.002', 'equ.dig.eso.001'],
  'equ.dig.eso': (t) => {
    if (/tor[aá]c/.test(t)) return ['equ.dig.eso.002', 'equ.dig.eso.001'];
    if (/abdom|hiato/.test(t)) return ['equ.dig.est.001', 'equ.dig.eso.002'];
    return ['equ.dig.eso.001', 'equ.dig.eso.002'];
  },
  'equ.dig.est': () => ['equ.dig.est.001'],
  'equ.dig.hig': () => ['equ.dig.hig.001'],
  'equ.dig.pan': () => ['equ.dig.hig.001', 'equ.dig.int.002'],
  'equ.dig.int': () => ['equ.dig.int.002'],
  'equ.dig.cie': () => ['equ.dig.cie.001'],
  'equ.dig.col': () => ['equ.dig.col.001'],
  'equ.dig.rec': () => ['equ.dig.rec.001'],
  'equ.dig.per': (t) => {
    if (/g[aá]str|omento|epiplo|espl[eé]n/.test(t)) return ['equ.dig.est.001', 'equ.dig.hig.001'];
    if (/hep[aá]t|falciforme|coronario|triangular/.test(t)) return ['equ.dig.hig.001'];
    if (/ceco|ileocecal/.test(t)) return ['equ.dig.cie.001'];
    if (/colon|mesocolon/.test(t)) return ['equ.dig.col.001'];
    if (/recto|mesorrecto/.test(t)) return ['equ.dig.rec.001'];
    if (/vejiga|vesic/.test(t)) return ['equ.uri.vej.001'];
    if (/[uú]ter|ov[aá]r|mesometr|ancho/.test(t)) return ['equ.rep.ute.001'];
    return ['equ.dig.int.002', 'equ.dig.col.001'];
  },

  // === ENDOCRINO ===
  'equ.end.hip': () => ['equ.end.hip.001'],
  'equ.end.epi': () => ['equ.ner.enc.001', 'equ.end.hip.001'],
  'equ.end.tir': () => ['equ.end.tir.001'],
  'equ.end.par': () => ['equ.end.tir.001'],
  'equ.end.sup': () => ['equ.end.sup.001'],
  'equ.end.otr': (t) => {
    if (/pancre|langerhans/.test(t)) return ['equ.dig.hig.001', 'equ.dig.int.002'];
    if (/carot[ií]d/.test(t)) return ['equ.car.acc.002'];
    if (/paraa[oó]rt|a[oó]rt/.test(t)) return ['equ.car.tpa.009'];
    return ['equ.end.tir.001', 'equ.end.hip.001'];
  },

  // === MUSCULAR ===
  'equ.mus.cab': (t) => {
    if (/p[aá]rpado|ojo|ocular|lagrimal/.test(t)) return ['equ.mus.cab.002', 'equ.sen.ocu.001'];
    if (/labio superior|canino|elevador/.test(t)) return ['equ.mus.cab.012', 'equ.mus.cab.011'];
    if (/labio inferior|menton/.test(t)) return ['equ.mus.cab.016', 'equ.mus.cab.013'];
    if (/boca|mejilla|buccin/.test(t)) return ['equ.mus.cab.014', 'equ.mus.cab.013'];
    if (/cigom[aá]t/.test(t)) return ['equ.mus.cab.015'];
    if (/nariz|nasal|ollar/.test(t)) return ['equ.mus.cab.049', 'equ.mus.cab.011'];
    if (/temporal|auricul|oreja/.test(t)) return ['equ.mus.cab.019', 'equ.ske.cra.008'];
    if (/maset|pterigoid|dig[aá]str/.test(t)) return ['equ.mus.cab.018'];
    return ['equ.mus.cab.018', 'equ.mus.cab.014'];
  },
  'equ.mus.far': () => ['equ.res.lar.002', 'equ.dig.eso.001'],
  'equ.mus.lar': () => ['equ.res.lar.002'],
  'equ.mus.len': () => ['equ.ske.cra.017', 'equ.mus.cab.014'],
  'equ.mus.pal': () => ['equ.ske.cra.014', 'equ.res.lar.002'],
  'equ.mus.cue': () => ['equ.mus.cue.002', 'equ.mus.cue.003'],
  'equ.mus.dor': () => ['equ.mus.dor.001', 'equ.mus.dor.002'],
  'equ.mus.tor': () => ['equ.mus.tor.001', 'equ.mus.tor.002'],
  'equ.mus.abd': () => ['equ.mus.abd.001', 'equ.mus.abd.002'],
  'equ.mus.col': () => ['equ.mus.col.001', 'equ.mus.col.003'],
  'equ.mus.sub': () => ['equ.mus.sub.001'],
  'equ.mus.fas': (t) => {
    if (/lata|gl[uú]t|femoral|crural|tars|metatars|popl/.test(t)) return ['equ.mus.fas.017', 'equ.mus.fem.002'];
    if (/braq|antebra|carp|metacarp|axil|escap/.test(t)) return ['equ.mus.ant.001', 'equ.mus.bra.002'];
    if (/tor[aá]c|pector|endotor/.test(t)) return ['equ.mus.tor.001'];
    if (/abdom|alba|transversalis|il[ií]ac/.test(t)) return ['equ.mus.abd.001'];
    if (/cuello|cervic|buc|maset|temporal|parot/.test(t)) return ['equ.mus.cab.018', 'equ.mus.cue.002'];
    return ['equ.mus.fas.017', 'equ.mus.tor.001'];
  },
  'equ.mus.hom': () => ['equ.mus.hom.001', 'equ.mus.hom.002'],
  'equ.mus.bra': () => ['equ.mus.bra.002', 'equ.mus.bra.004'],
  'equ.mus.ant': () => ['equ.mus.ant.001', 'equ.mus.ant.003'],
  'equ.mus.man': () => ['equ.ske.lmt.005', 'equ.mus.ant.001'],
  'equ.mus.cad': () => ['equ.mus.cad.001', 'equ.mus.cad.002'],
  'equ.mus.fem': () => ['equ.mus.fem.002', 'equ.mus.fem.003'],
  'equ.mus.pie': () => ['equ.mus.pie.001', 'equ.mus.pie.002'],
  'equ.mus.pes': () => ['equ.mus.pie.001', 'equ.ske.lmp.015'],
  'equ.mus.ext': () => ['equ.mus.ext.001', 'equ.mus.ext.002'],
  'equ.mus.per': () => ['equ.dig.rec.001', 'equ.mus.col.001'],

  // === NERVIOSO ===
  'equ.ner.enc': () => ['equ.ner.enc.001'],
  'equ.ner.tel': () => ['equ.ner.enc.001'],
  'equ.ner.die': () => ['equ.ner.enc.001'],
  'equ.ner.mes': () => ['equ.ner.enc.001'],
  'equ.ner.nuc': () => ['equ.ner.enc.001'],
  'equ.ner.ven': () => ['equ.ner.enc.001'],
  'equ.ner.met': (t) => (/cerebel/.test(t) ? ['equ.ner.met.008', 'equ.ner.enc.001'] : ['equ.ner.enc.001', 'equ.ner.met.008']),
  'equ.ner.mie': () => ['equ.ner.enc.001', 'equ.ner.med.001'],
  'equ.ner.med': () => ['equ.ner.med.001'],
  'equ.ner.tra': (t) =>
    /cerebel/.test(t)
      ? ['equ.ner.met.008', 'equ.ner.med.001']
      : /talam|c[oó]rtic|cuerpo calloso|f[oó]rnix|c[aá]psula/.test(t)
        ? ['equ.ner.enc.001', 'equ.ner.med.001']
        : ['equ.ner.med.001', 'equ.ner.enc.001'],
  'equ.ner.men': (t) =>
    /espinal|filum|cola de caballo/.test(t) ? ['equ.ner.med.001'] : ['equ.ner.enc.001', 'equ.ner.med.001'],
  'equ.ner.cra': (t) => {
    if (/vago|lar[ií]ngeo|esof[aá]g|card[ií]ac/.test(t)) return ['equ.ner.cra.077', 'equ.ner.enc.001'];
    if (/[oó]ptico|oculomotor|troclear|abducens|oft[aá]lmic/.test(t)) return ['equ.sen.ocu.001', 'equ.ner.enc.001'];
    if (/vestibulococlear/.test(t)) return ['equ.ske.cra.008', 'equ.ner.enc.001'];
    return ['equ.ner.enc.001', 'equ.ner.cra.077'];
  },
  'equ.ner.bra': () => ['equ.ner.bra.001'],
  'equ.ner.lum': () => ['equ.ner.lum.010'],
  'equ.ner.cer': () => ['equ.ner.bra.001', 'equ.ner.med.001'],
  'equ.ner.tro': () => ['equ.ner.med.001', 'equ.ner.lum.010'],
  'equ.ner.esp': (t) => {
    if (/braquial|c6|c7|c8|t1|t2|radial|mediano|ulnar|supraescap|axilar|musculocut/.test(t)) {
      return ['equ.ner.bra.001', 'equ.ner.med.001'];
    }
    if (/ci[aá]t|femoral|obturad|perone|tibial|gl[uú]t|pudend|l4|l5|l6|s1|s2|s3|lumbosacr/.test(t)) {
      return ['equ.ner.lum.010', 'equ.ner.med.001'];
    }
    return ['equ.ner.med.001'];
  },
  'equ.ner.aut': (t) => {
    if (/vago|lar[ií]ng|card[ií]ac|pulmonar|esof[aá]g/.test(t)) return ['equ.ner.cra.077', 'equ.ner.med.001'];
    if (/ciliar|pterigopal|mandibular|[oó]tico|oft[aá]lm|craneal/.test(t)) return ['equ.ner.enc.001'];
    if (/cel[ií]ac|mesent|espl[aá]cn|a[oó]rt|renal/.test(t)) return ['equ.car.tpa.009', 'equ.ner.med.001'];
    if (/p[eé]lv|hipog[aá]str|sacr/.test(t)) return ['equ.ner.lum.010', 'equ.ner.med.001'];
    return ['equ.ner.med.001', 'equ.ner.cra.077'];
  },

  // === REPRODUCTOR ===
  'equ.rep.ova': () => ['equ.rep.ova.001', 'equ.rep.ute.001'],
  'equ.rep.ute': () => ['equ.rep.ute.001'],
  'equ.rep.vag': () => ['equ.rep.ute.001'],
  'equ.rep.mam': () => ['equ.rep.ute.001', 'equ.teg.pie.001'],
  'equ.rep.fet': () => ['equ.rep.ute.001'],
  'equ.rep.tes': () => ['equ.rep.tes.001'],
  'equ.rep.esc': () => ['equ.rep.tes.001'],
  'equ.rep.pen': () => ['equ.rep.pen.001'],
  'equ.rep.gla': () => ['equ.rep.pen.001', 'equ.uri.vej.001'],

  // === RESPIRATORIO ===
  'equ.res.cav': () => ['equ.res.cav.001'],
  'equ.res.nar': () => ['equ.res.cav.001'],
  'equ.res.sen': () => ['equ.res.cav.001', 'equ.ske.cra.007'],
  'equ.res.fan': () => ['equ.res.lar.002', 'equ.res.cav.001'],
  'equ.res.lar': () => ['equ.res.lar.002'],
  'equ.res.tra': (t) => {
    if (/bronqu/.test(t)) return ['equ.res.tra.007', 'equ.res.tra.002'];
    if (/tor[aá]c|bifurc|carina/.test(t)) return ['equ.res.tra.002', 'equ.res.tra.001'];
    return ['equ.res.tra.001', 'equ.res.tra.002'];
  },
  'equ.res.pul': () => ['equ.res.pul.001'],
  'equ.res.ple': () => ['equ.res.pul.001'],

  // === SENSORIAL ===
  'equ.sen.ocu': () => ['equ.sen.ocu.001'],
  'equ.sen.ane': () => ['equ.sen.ocu.001'],
  'equ.sen.oex': () => ['equ.ske.cra.008'],
  'equ.sen.omd': () => ['equ.ske.cra.008'],
  'equ.sen.oin': () => ['equ.ske.cra.008'],
  'equ.sen.olf': () => ['equ.res.cav.001'],
  'equ.sen.gus': () => ['equ.ske.cra.017', 'equ.mus.cab.014'],

  // === ESQUELÉTICO Y ARTICULAR ===
  'equ.ske.cra': (t) => {
    if (/concha|nasal/.test(t)) return ['equ.ske.cra.009', 'equ.ske.cra.012'];
    if (/occip/.test(t)) return ['equ.ske.cra.001'];
    return ['equ.ske.cra.001', 'equ.ske.cra.007'];
  },
  'equ.ske.sut': (t) => {
    if (/front/.test(t)) return ['equ.ske.cra.007', 'equ.ske.cra.006'];
    if (/nasal/.test(t)) return ['equ.ske.cra.009', 'equ.ske.cra.012'];
    if (/pariet|occip|lambd|sagital/.test(t)) return ['equ.ske.cra.006', 'equ.ske.cra.001'];
    if (/tempor|escamos/.test(t)) return ['equ.ske.cra.008'];
    return ['equ.ske.cra.006', 'equ.ske.cra.007', 'equ.ske.cra.001'];
  },
  'equ.ske.hyo': () => ['equ.ske.cra.017', 'equ.ske.cra.008'],
  'equ.ske.cau': () => ['equ.ske.cau.018', 'equ.ske.cau.015'],
  'equ.ske.aax': () => ['equ.ske.aax.002', 'equ.ske.aax.001'],
  'equ.ske.amp': (t) => {
    if (/tars|corvej/.test(t)) return ['equ.ske.amp.007', 'equ.ske.amp.008'];
    if (/tibioperon|femorotib|femoropatel|rodilla/.test(t)) return ['equ.ske.amp.002', 'equ.ske.amp.003'];
    return ['equ.ske.amp.001', 'equ.ske.amp.007'];
  },
  'equ.ske.amt': (t) => {
    if (/carpo|carpometacarp/.test(t)) return ['equ.ske.amt.004', 'equ.ske.amt.005'];
    if (/radiocubital|codo/.test(t)) return ['equ.ske.amt.002'];
    return ['equ.ske.amt.004', 'equ.ske.amt.008'];
  },
  'equ.ske.lax': (t) => {
    if (/sacroil/.test(t)) return ['equ.ske.lax.009', 'equ.ske.lax.011'];
    if (/nucal/.test(t)) return ['equ.ske.lax.001', 'equ.ske.lax.002'];
    if (/longitudinal/.test(t)) return ['equ.ske.lax.004'];
    return ['equ.ske.lax.003', 'equ.ske.lax.004'];
  },
  'equ.ske.lmp': (t) => {
    if (/rodilla|colateral.*rodilla|patel/.test(t)) return ['equ.ske.lmp.003', 'equ.ske.lmp.008'];
    if (/tarso|corvej|plantar/.test(t)) return ['equ.ske.lmp.014', 'equ.ske.lmp.015'];
    return ['equ.ske.lmp.015', 'equ.ske.lmp.016'];
  },
  'equ.ske.lmt': (t) => {
    if (/codo/.test(t)) return ['equ.ske.amt.002'];
    if (/carpo/.test(t)) return ['equ.ske.amt.004', 'equ.ske.lmt.005'];
    return ['equ.ske.lmt.005', 'equ.ske.lmt.010'];
  },

  // === TEGUMENTARIO ===
  'equ.teg.cmp': () => ['equ.teg.cmp.001'],
  'equ.teg.cmt': () => ['equ.teg.cmt.001'],
  'equ.teg.esp': (t) =>
    /p[eé]lvic/.test(t) ? ['equ.teg.cmp.001'] : ['equ.teg.cmt.001'],
  'equ.teg.pel': () => ['equ.teg.pel.011', 'equ.teg.pie.001'],
  'equ.teg.pie': () => ['equ.teg.pie.001'],
  'equ.teg.gla': () => ['equ.teg.pie.001'],

  // === URINARIO ===
  'equ.uri.rin': () => ['equ.uri.rin.001'],
  'equ.uri.ure': () => ['equ.uri.ure.001'],
  'equ.uri.vej': () => ['equ.uri.vej.001'],
  'equ.uri.uet': () => ['equ.uri.vej.001', 'equ.rep.pen.001'],
};

const SYSTEM_FALLBACKS: Record<SystemCode, string[]> = {
  ske: ['equ.ske.cra.001', 'equ.ske.tor.001'],
  art: ['equ.ske.aax.002', 'equ.ske.amt.004'],
  mus: ['equ.mus.tor.001', 'equ.mus.fem.002'],
  dig: ['equ.dig.int.002', 'equ.dig.est.001'],
  res: ['equ.res.pul.001', 'equ.res.tra.001'],
  car: ['equ.car.cor.001', 'equ.car.tpa.008'],
  ner: ['equ.ner.enc.001', 'equ.ner.med.001'],
  uri: ['equ.uri.rin.001', 'equ.uri.vej.001'],
  rep: ['equ.rep.ute.001', 'equ.rep.tes.001'],
  teg: ['equ.teg.pie.001', 'equ.teg.cmt.001'],
  end: ['equ.end.tir.001', 'equ.end.hip.001'],
  sen: ['equ.sen.ocu.001', 'equ.ske.cra.008'],
};

export function resolveSingleStructureAnchor(
  record: StructureRecord,
  items: Record<string, AnchorableSceneItem>,
): Anatomy3DAnchor | null {
  const own = items[record.id];
  if (own?.hasMesh) {
    return { targetId: record.id, isProxy: false };
  }

  const side = getSideFromRecord(record);

  // 1. Direct conceptual link in ProClaVet record
  const linkedId = record.relacion_conceptual?.vinculada_a;
  if (linkedId) {
    const linked = pickMountedVariant(linkedId, side, items);
    if (linked) {
      return { targetId: linked, isProxy: true };
    }
  }

  // 2. Same region prefix (`equ.<sys>.<reg>`) mounted items
  const parts = record.id.split('.');
  const regionPrefix = parts.length >= 3 ? parts.slice(0, 3).join('.') : '';
  const text = `${record.es} ${record.la} ${record.ficha?.ubicacion || ''}`.toLowerCase();

  // 3. Explicit region anchor rules (respecting laterality & anatomical subregion keywords)
  const regionRule = REGION_RULES[regionPrefix];
  if (regionRule) {
    const picked = pickFirstMounted(regionRule(text), side, items);
    if (picked) {
      return { targetId: picked, isProxy: true };
    }
  }

  // 4. Fallback: any mounted item sharing the exact region prefix (matching side first)
  if (regionPrefix) {
    const prefixDot = `${regionPrefix}.`;
    const regionMounted = Object.keys(items).filter(
      (id) => id.startsWith(prefixDot) && items[id]?.hasMesh,
    );
    if (regionMounted.length > 0) {
      regionMounted.sort();
      const sideMatch =
        side === 'left'
          ? regionMounted.find((id) => id.endsWith('-i'))
          : side === 'right'
            ? regionMounted.find((id) => id.endsWith('-d'))
            : undefined;
      return { targetId: sideMatch || regionMounted[0], isProxy: true };
    }
  }

  // 5. System-level fallback guaranteeing complete 3D coverage across all 3,846 records
  const sysKey = record._catalog === 'art' ? 'art' : record.sys;
  const sysPicked = pickFirstMounted(SYSTEM_FALLBACKS[sysKey] || [], side, items);
  if (sysPicked) {
    return { targetId: sysPicked, isProxy: true };
  }

  return null;
}

export function buildAnatomyAnchorMap(
  items: Record<string, AnchorableSceneItem>,
): Record<string, Anatomy3DAnchor> {
  const out: Record<string, Anatomy3DAnchor> = {};
  for (const it of Object.values(items)) {
    const resolved = resolveSingleStructureAnchor(it.record, items);
    if (resolved) {
      out[it.record.id] = resolved;
    }
  }
  return out;
}
