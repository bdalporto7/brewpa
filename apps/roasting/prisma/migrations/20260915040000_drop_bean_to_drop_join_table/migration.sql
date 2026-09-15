-- Every row from the old implicit Bean<->Drop join table was already
-- backfilled into DropItem by the add_drop_item migration, and every
-- application touch point has since moved onto DropItem — this table is
-- now dead weight.
PRAGMA foreign_keys=OFF;

DROP TABLE "_BeanToDrop";

PRAGMA foreign_keys=ON;
