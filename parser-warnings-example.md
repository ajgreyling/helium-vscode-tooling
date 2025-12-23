# Parser Warnings Example

These are parser warnings (not actual code errors) - the code builds fine. These warnings indicate parser limitations in handling certain syntax patterns.

## File: `services/AttachmentQueueService.mez`

**Line 56:**
```mez
Mez:log(String:concat("Cleaned up ", oldItems.length(), " old attachment queue items"));
```

**Parser Warnings:**
- `mismatched input ')' expecting ','`
- `extraneous input ')' expecting ';'`

**Issue:** The parser has trouble parsing method calls like `oldItems.length()` inside `String:concat()` arguments.

---

## File: `services/CaseManagement.mez`

**Line 15:**
```mez
requestBody.jsonPut("text_english", TranslationService:translateMessageGoogle(userMsg.text, user_language, "English"));
```

**Parser Warning:**
- `mismatched input ')' expecting {',', '==', '!=', '<', '<=', '>', '>=', '||', '&&', '+', '-', '*', '/', '%'}`

**Issue:** The parser has trouble parsing nested method calls where a method call is passed as an argument to another method call.

**Line 62:**
```mez
requestBody.jsonPut("text_english", TranslationService:translateMessageGoogle(assistantMsg.text, user_language, "English"));
```

**Parser Warning:** Same issue - nested method calls.

**Line 163:**
```mez
request.body.jsonPut("facility_gis_number", "");
```

**Parser Warning:** 
- `mismatched input ')' expecting {',', '==', '!=', '<', '<=', '>', '>=', '||', '&&', '+', '-', '*', '/', '%'}`

**Issue:** The parser has trouble with method chaining (`request.body.jsonPut`).

**Line 166:**
```mez
request.body.jsonPut("channel", "munic-chat");
```

**Parser Warning:** Same issue - method chaining.

**Line 182:**
```mez
incident.coordinates = String:replaceAll(incident.coordinates, " ", "");
```

**Parser Warning:** Same issue - method calls with dot notation.

---

## File: `services/ChatGptWrapper.mez`

**Line 150:**
```mez
requestBody.jsonPut("model", "gpt-4.1");
```

**Parser Warning:**
- `mismatched input ')' expecting {',', '==', '!=', '<', '<=', '>', '>=', '||', '&&', '+', '-', '*', '/', '%'}`

**Issue:** Similar parser limitations with method calls.

---

## Summary

All 36 remaining issues are **parser warnings**, not actual code errors. The parser has limitations with:
1. Nested method calls (method calls as arguments to other methods)
2. Method chaining (e.g., `request.body.jsonPut`)
3. Method calls with dot notation in expressions

Since the code builds fine in the actual DSL compiler, these are false positives from parser limitations, not real errors.
