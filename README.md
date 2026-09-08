# WebMCP -GForms Config Generator
https://yonisantiago.github.io/WebMCP-Gravity-Config-File-Generator/webmcp-config-generator.html
Turns a GravityForms export into a `webmcp-gravityforms-config.php` file, in the
format expected by the WebMCP GravityForms integration.

It's a single HTML file — no install, no server, no build step. Open it in
any browser and it runs entirely client-side.

## Quick start

1. In WordPress, go to **Forms → Import/Export → Export Forms** and export the
   forms you need. This gives you a `.json` file.
2. Open `webmcp-config-generator.html` in any browser (double-click it, or
   host it as a static page — either works).
3. Drag the exported `.json` file onto the page, or click to choose it.
4. Each detected form appears as a card on the left with:
   - a checkbox to include/exclude the whole form,
   - an editable **toolname**,
   - an editable **tooldescription**,
   - a checkbox + editable description for every field.
5. Review and rewrite the descriptions (see **Writing good descriptions**
   below) — the generated PHP updates live on the right as you edit.
6. Click **Download .php** (or **Copy**) to get the final file.
7. Drop it into your child theme's `includes/webmcp/` directory.

## What gets skipped automatically

| Type | Why it's skipped |
|---|---|
| `hidden` | Populated automatically, not user input |
| `uid` | Auto-generated unique ID |
| `captcha` | Not a data field |
| `consent`, `checkbox` | Almost always a terms/consent checkbox |
| `html`, `page`, `section` | Layout, not data |
| `save` | "Save and continue" control |

If a form uses a checkbox for real data (not consent), just re-check its box
in the tool before downloading.

Multi-part fields — like a Name field split into First/Last, or an Address
field — are expanded into separate entries (`input_1_3`, `input_1_6`, etc.)
rather than being skipped.

## Writing good descriptions

The generated `toolname` and `tooldescription` are only starting points,
built from the form's title. The AI tool relies on these descriptions to
decide *when* and *how* to use each form, so before downloading:

- Rewrite `tooldescription` in plain language: what the form is for, and
  what happens after someone submits it.
- Rewrite each field description so it's unambiguous on its own — e.g.
  `"Phone Number"` → `"Phone number to call the person back on."`
- Double check the field IDs (`input_N`) against the live form's HTML if
  you're not sure the export matches what's deployed — field IDs can drift
  if a form has been edited.

## Example output

```php
3 => [
    'toolname'        => 'submitFreeCaseEvaluationForm',
    'tooldescription' => 'Submit a Free Case Evaluation enquiry to the team and we will get back to you shortly.',
    'fields'          => [
        'input_1' => 'Name of the person submitting the enquiry.',
        'input_15' => 'Last Name of the person submitting the enquiry.',
        'input_5' => 'Phone Number of the person submitting the enquiry.',
        'input_4' => 'Email Address.',
        'input_6' => 'Describe your case in this text field.',
    ],
],
```

## Files

- `webmcp-config-generator.html` — the tool
