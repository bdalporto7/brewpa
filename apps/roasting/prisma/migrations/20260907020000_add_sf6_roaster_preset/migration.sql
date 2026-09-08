-- Every team gets every roaster this app currently supports — which
-- machines exist is a catalog shipped in code (see
-- src/lib/roasters.ts's ROASTER_PRESETS), never something a team adds or
-- removes itself. This seeds the second supported machine, San Franciscan
-- SF-6, for every team that doesn't already have one — not the default
-- (isDefault stays with each team's existing Fresh Roast SR800 row), just
-- now selectable when starting a roast. Literal JSON here matches
-- src/lib/roasters.ts's SF6_CONTROLS/SF6_PROBES exactly.
INSERT INTO "RoasterDefinition" ("id", "name", "isDefault", "supportsAiSuggestions", "controlsJson", "probesJson", "createdAt", "updatedAt", "teamId")
SELECT lower(hex(randomblob(16))), 'San Franciscan SF-6', false, false,
       '[{"key":"GAS","label":"Gas","min":0,"max":10,"defaultValue":5,"icon":"gauge","widget":"stepper"},{"key":"DAMPER","label":"Damper","min":0,"max":10,"defaultValue":5,"icon":"wind","widget":"stepper"}]',
       '[{"key":"bean","label":"Bean (BT)"},{"key":"environment","label":"Environment (ET)"}]',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "id"
FROM "Team"
WHERE NOT EXISTS (
  SELECT 1 FROM "RoasterDefinition" WHERE "RoasterDefinition"."teamId" = "Team"."id" AND "RoasterDefinition"."name" = 'San Franciscan SF-6'
);
