
(function(){
  "use strict";

  const SKIP_FIELD_TYPES = new Set(['hidden','uid','captcha','consent','checkbox','html','page','section','save']);

  let state = { forms: [] }; // [{id, title, include, toolname, tooldescription, fields:[{key, label, include}]}]

  // ---------- parsing / generation logic (mirrors the PHP/CLI version) ----------

  function cleanLabel(label){
    if(!label) return '';
    const div = document.createElement('div');
    div.innerHTML = label;
    let text = div.textContent || div.innerText || '';
    text = text.replace(/\s+/g,' ').trim();
    return text;
  }

  function generateToolName(title){
    let suffixWords = [];
    let base = title;
    const m = title.match(/\(([^)]+)\)/);
    if(m){
      suffixWords = m[1].match(/[A-Za-z0-9]+/g) || [];
      base = title.replace(m[0], '');
    }
    const words = (base.match(/[A-Za-z0-9]+/g) || []).concat(suffixWords);
    let camel = 'submit';
    for(const w of words){
      camel += w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    return camel;
  }

  function generateToolDescription(title){
    return `Submit the "${title}" form and we will get back to you shortly. TODO: review this description.`;
  }

  function extractForms(data){
    const forms = [];
    const entries = Array.isArray(data) ? data : Object.values(data || {});
    for(const entry of entries){
      if(entry && typeof entry === 'object' && 'id' in entry && Array.isArray(entry.fields)){
        forms.push(entry);
      }
    }
    forms.sort((a,b) => a.id - b.id);
    return forms;
  }

  function buildFieldsList(formFields){
    const fields = [];
    const seen = new Set();
    for(const field of formFields){
      const type = field.type || '';
      const skippedByType = SKIP_FIELD_TYPES.has(type);
      if(field.inputs && Array.isArray(field.inputs) && field.inputs.length){
        for(const sub of field.inputs){
          const subId = String(sub.id).replace('.', '_');
          const key = `input_${subId}`;
          if(seen.has(key)) continue;
          seen.add(key);
          fields.push({
            key,
            label: cleanLabel(sub.label || field.label || ''),
            include: !skippedByType
          });
        }
      } else {
        if(field.id === undefined || field.id === null) continue;
        const key = `input_${field.id}`;
        if(seen.has(key)) continue;
        seen.add(key);
        fields.push({
          key,
          label: cleanLabel(field.label || ''),
          include: !skippedByType
        });
      }
    }
    return fields;
  }

  function phpStringLiteral(value){
    const escaped = String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `'${escaped}'`;
  }

  // ---------- rendering left panel (editable review UI) ----------

  function renderFormsList(){
    const container = document.getElementById('formsList');
    container.innerHTML = '';
    if(!state.forms.length){
      return;
    }
    state.forms.forEach((form, fi) => {
      const card = document.createElement('div');
      card.className = 'form-card';

      const head = document.createElement('div');
      head.className = 'form-card-head';
      head.innerHTML = `
        <input type="checkbox" ${form.include ? 'checked':''} data-role="form-include">
        <span class="id-badge">#${form.id}</span>
        <span class="title">${form.title}</span>
        <span class="chev">▾</span>
      `;
      head.querySelector('[data-role="form-include"]').addEventListener('click', e => e.stopPropagation());
      head.querySelector('[data-role="form-include"]').addEventListener('change', e => {
        form.include = e.target.checked;
        regenerate();
      });
      head.addEventListener('click', () => {
        card.classList.toggle('collapsed');
      });

      const body = document.createElement('div');
      body.className = 'form-card-body';

      const toolLabel = document.createElement('label');
      toolLabel.className = 'meta-label';
      toolLabel.textContent = 'toolname';
      const toolInput = document.createElement('input');
      toolInput.className = 'meta-input';
      toolInput.type = 'text';
      toolInput.value = form.toolname;
      toolInput.addEventListener('input', e => { form.toolname = e.target.value; regenerate(); });

      const descLabel = document.createElement('label');
      descLabel.className = 'meta-label';
      descLabel.textContent = 'tooldescription';
      const descInput = document.createElement('textarea');
      descInput.className = 'meta-input';
      descInput.value = form.tooldescription;
      descInput.addEventListener('input', e => { form.tooldescription = e.target.value; regenerate(); });

      const fieldsLabel = document.createElement('label');
      fieldsLabel.className = 'meta-label';
      fieldsLabel.textContent = `fields (${form.fields.filter(f=>f.include).length}/${form.fields.length} included)`;

      body.appendChild(toolLabel);
      body.appendChild(toolInput);
      body.appendChild(descLabel);
      body.appendChild(descInput);
      body.appendChild(fieldsLabel);

      form.fields.forEach((field, fieldi) => {
        const row = document.createElement('div');
        row.className = 'field-row' + (field.include ? '' : ' skipped');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = field.include;
        cb.addEventListener('change', e => {
          field.include = e.target.checked;
          row.classList.toggle('skipped', !field.include);
          regenerate();
        });

        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = field.key;

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = field.label;
        labelInput.addEventListener('input', e => {
          field.label = e.target.value;
          regenerate();
        });

        row.appendChild(cb);
        row.appendChild(key);
        row.appendChild(labelInput);
        body.appendChild(row);
      });

      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  // ---------- output rendering ----------

  function escapeHtml(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function buildPhp(){
    const included = state.forms.filter(f => f.include);
    let out = "<?php\n";
    out += "/**\n";
    out += " * WebMCP GravityForms Configuration\n";
    out += " *\n";
    out += " * Generated with the WebMCP Config Generator — review before shipping!\n";
    out += " * Generated: " + new Date().toISOString() + "\n";
    out += " *\n";
    out += " * @package WebMCP\n";
    out += " * @subpackage GravityForms\n";
    out += " * @since 1.0.0\n";
    out += " */\n\n";
    out += "// Exit if accessed directly\n";
    out += "if ( ! defined( 'ABSPATH' ) ) {\n\texit;\n}\n\n";
    out += "return [\n";

    included.forEach(form => {
      const fields = form.fields.filter(f => f.include);
      out += `\t// Form ID ${form.id} - ${form.title}\n`;
      out += `\t${form.id} => [\n`;
      out += `\t\t'toolname'        => ${phpStringLiteral(form.toolname)},\n`;
      out += `\t\t'tooldescription' => ${phpStringLiteral(form.tooldescription)},\n`;
      out += `\t\t'fields'          => [\n`;
      fields.forEach(f => {
        out += `\t\t\t'${f.key}' => ${phpStringLiteral(f.label.endsWith('.') ? f.label : f.label + '.')},\n`;
      });
      out += `\t\t],\n`;
      out += `\t],\n\n`;
    });

    out += "];\n";
    return out;
  }

  function highlight(php){
    const lines = php.split('\n').map(line => {
      let esc = escapeHtml(line);
      if(/^\s*(\/\/|\*|\/\*)/.test(line)){
        return `<span class="tok-comment">${esc}</span>`;
      }
      esc = esc.replace(/(&#039;(?:[^&]|&(?!#039;))*?&#039;|'(?:[^'\\]|\\.)*')/g, m => `<span class="tok-string">${m}</span>`);
      return esc;
    });
    return lines.join('\n');
  }

  function regenerate(){
    const output = document.getElementById('output');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const todoCount = document.getElementById('todoCount');

    if(!state.forms.length){
      output.innerHTML = '<span class="tok-comment">// Upload a GravityForms JSON export on the left to generate a config file here.</span>';
      copyBtn.disabled = true;
      downloadBtn.disabled = true;
      todoCount.textContent = '';
      return;
    }

    const php = buildPhp();
    output.innerHTML = highlight(php);
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    state.currentPhp = php;

    const todos = (php.match(/TODO:/g) || []).length;
    todoCount.textContent = todos ? `${todos} description${todos===1?'':'s'} need review` : '';
  }

  // ---------- file loading ----------

  function loadFile(file){
    const reader = new FileReader();
    reader.onload = e => {
      let data;
      try{
        data = JSON.parse(e.target.result);
      } catch(err){
        alert('That file is not valid JSON: ' + err.message);
        return;
      }
      const rawForms = extractForms(data);
      if(!rawForms.length){
        alert('No forms found in this export.');
        return;
      }
      state.forms = rawForms.map(form => ({
        id: form.id,
        title: form.title || `Form ${form.id}`,
        include: true,
        toolname: generateToolName(form.title || `Form ${form.id}`),
        tooldescription: generateToolDescription(form.title || `Form ${form.id}`),
        fields: buildFieldsList(form.fields)
      }));

      const leftBody = document.getElementById('leftBody');
      let loaded = document.getElementById('fileLoadedBanner');
      if(!loaded){
        loaded = document.createElement('div');
        loaded.id = 'fileLoadedBanner';
        loaded.className = 'file-loaded';
        leftBody.insertBefore(loaded, leftBody.firstChild);
      }
      loaded.innerHTML = `<span>${file.name} — ${state.forms.length} form${state.forms.length===1?'':'s'} found</span><button id="clearBtn">clear</button>`;
      loaded.querySelector('#clearBtn').addEventListener('click', () => {
        state.forms = [];
        loaded.remove();
        document.getElementById('dropzone').style.display = '';
        renderFormsList();
        regenerate();
      });

      document.getElementById('dropzone').style.display = 'none';
      renderFormsList();
      regenerate();
    };
    reader.readAsText(file);
  }

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    if(e.target.files[0]) loadFile(e.target.files[0]);
  });
  ['dragenter','dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('drag');
    });
  });
  ['dragleave','drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.remove('drag');
    });
  });
  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if(file) loadFile(file);
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    if(!state.currentPhp) return;
    navigator.clipboard.writeText(state.currentPhp).then(() => {
      const btn = document.getElementById('copyBtn');
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1400);
    });
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    if(!state.currentPhp) return;
    const blob = new Blob([state.currentPhp], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'webmcp-gravityforms-config.php';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

})();
