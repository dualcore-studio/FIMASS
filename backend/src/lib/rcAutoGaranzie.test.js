const test = require('node:test');
const assert = require('node:assert/strict');
const { getRcGaranzieSelezionate, resolveRcAutoGuaranteeSource } = require('./rcAutoGaranzie');

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
