﻿
DELETE FROM SEQUENCE_GEN;
DELETE FROM PREFERENCES;
DELETE FROM ALBUMS_COUNTRIES;
DELETE FROM COUNTRIES;
DELETE FROM ALBUMS;
DELETE FROM STAMPCOLLECTIONS;
INSERT INTO COUNTRIES (ID,NAME,CREATESTAMP) VALUES (1,'Australia','2014-09-27 00:00:00');
INSERT INTO COUNTRIES (ID,NAME,CREATESTAMP) VALUES (2,'Canada','2014-09-27 00:00:00');
INSERT INTO PREFERENCES (ID,CATEGORY,NAME,VALUE,CREATESTAMP) VALUES (1,'stamps', 'imagePath', 'http://drake-server.dnsdynamic.com','2014-09-27 00:00:00');
INSERT INTO STAMPCOLLECTIONS (ID,NAME,CREATESTAMP) VALUES (1, 'British Commonwealth','2014-09-27 00:00:00');
INSERT INTO ALBUMS (ID,NAME,COLLECTION_ID,CREATESTAMP) VALUES (1, 'Australia', 1,'2014-09-27 00:00:00');
INSERT INTO ALBUMS (ID,NAME,COLLECTION_ID,CREATESTAMP) VALUES (2, 'Australian States', 1,'2014-09-27 00:00:00');
INSERT INTO ALBUMS_COUNTRIES (ALBUM_ID,COUNTRY_ID) VALUES (1,1);
INSERT INTO SEQUENCE_GEN (ID_NAME,ID_VAL) VALUES ('ALBUM_ID', 1000);
INSERT INTO SEQUENCE_GEN (ID_NAME,ID_VAL) VALUES ('COLLECTION_ID', 1000);
INSERT INTO SEQUENCE_GEN (ID_NAME,ID_VAL) VALUES ('COUNTRY_ID', 1000);
INSERT INTO SEQUENCE_GEN (ID_NAME,ID_VAL) VALUES ('PREF_ID', 1000);
