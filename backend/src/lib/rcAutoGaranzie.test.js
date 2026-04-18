const test = require('node:test');
const assert = require('node:assert/strict');
const { getRcGaranzieSelezionate, resolveRcAutoGuaranteeSource } = require('./rcAutoGaranzie');

test('RC Auto: rc true in root → etichetta RC Auto', () => {
  assert.deepEqual(getRcGaranzieSelezionate({ rc: true, furto: false, ass: false }), ['RC Auto']);
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
  assert.deepEqual(getRcGaranzieSelezionate(ds), ['RC Auto', 'Furto e Incendio', 'Tutela Legale']);
  const src = resolveRcAutoGuaranteeSource(ds);
  assert.equal(src, ds.formData);
});

test('RC Auto: stringa Si non conta come selezionata', () => {
  assert.deepEqual(getRcGaranzieSelezionate({ rc: 'Si', furto: 'No' }), []);
});

test('RC Auto: nessuna garanzia true', () => {
  assert.deepEqual(getRcGaranzieSelezionate({ rc: false, furto: false }), []);
});
