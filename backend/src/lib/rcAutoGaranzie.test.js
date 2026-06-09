const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getRcGaranzieSelezionate,
  resolveRcAutoGuaranteeSource,
  parseIntermediazioneValue,
  totalWithIntermediazione,
} = require('./rcAutoGaranzie');

test('RC Auto: rc true in root → etichetta RC', () => {
  assert.deepEqual(getRcGaranzieSelezionate({ rc: true, furto: false, ass: false }), ['RC']);
});

test('RC Auto: più garanzie true e nested formData', () => {
  const ds = {
    targa: 'AB123CD',
    formData: {
      rc: true,
      furto: true,
      ass: false,
      tutela: true,
    },
  };
  assert.deepEqual(getRcGaranzieSelezionate(ds), ['RC', 'Furto e Incendio', 'Tutela Legale']);
  const src = resolveRcAutoGuaranteeSource(ds);
  assert.equal(src, ds.formData);
});

test('RC Auto: stringa Si non conta come selezionata', () => {
  assert.deepEqual(getRcGaranzieSelezionate({ rc: 'Si', furto: 'No' }), []);
});

test('RC Auto: nessuna garanzia true', () => {
  assert.deepEqual(getRcGaranzieSelezionate({ rc: false, furto: false }), []);
});

test('RC Auto: fallback multiselect garanzie_selezionate se nessun booleano true', () => {
  const ds = {
    targa: 'XY999ZZ',
    garanzie_selezionate: ['RC Auto', 'Assistenza Stradale', 'Cristalli'],
  };
  assert.deepEqual(getRcGaranzieSelezionate(ds), ['RC', 'Assistenza Stradale', 'Cristalli']);
});

test('RC Auto: booleani vincono su multiselect', () => {
  const ds = {
    rc: true,
    furto: false,
    garanzie_selezionate: ['Furto e Incendio', 'Cristalli'],
  };
  assert.deepEqual(getRcGaranzieSelezionate(ds), ['RC']);
});

test('parseIntermediazioneValue: numero valido (string con virgola)', () => {
  assert.deepEqual(parseIntermediazioneValue('12,50'), { ok: true, value: 12.5 });
  assert.deepEqual(parseIntermediazioneValue('100'), { ok: true, value: 100 });
  assert.deepEqual(parseIntermediazioneValue(0), { ok: true, value: 0 });
});

test('parseIntermediazioneValue: rifiuta valori mancanti o negativi', () => {
  assert.equal(parseIntermediazioneValue('').ok, false);
  assert.equal(parseIntermediazioneValue(null).ok, false);
  assert.equal(parseIntermediazioneValue(undefined).ok, false);
  assert.equal(parseIntermediazioneValue(-3).ok, false);
  assert.equal(parseIntermediazioneValue('abc').ok, false);
});

test('totalWithIntermediazione: somma garanzie + intermediazione', () => {
  const breakdown = [
    { nome: 'RC', prezzo: 200 },
    { nome: 'Furto e Incendio', prezzo: 50.5 },
  ];
  assert.equal(totalWithIntermediazione(breakdown, 25), 275.5);
  assert.equal(totalWithIntermediazione(breakdown, 0), 250.5);
  assert.equal(totalWithIntermediazione(breakdown, null), 250.5);
});
