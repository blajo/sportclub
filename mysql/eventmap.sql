-- ###########################################################
-- # File:    schema.sql                                      #
-- # -------------------------------------------------------- #
-- # All club events shown on the EventMap, both legacy       #
-- # (pre-Eventor, entered by hand) and events synced from    #
-- # Eventor. SOURCE distinguishes them.                      #
-- ###########################################################

CREATE TABLE IF NOT EXISTS EVENTMAP_EVENTS (
  EVENT_ID            VARCHAR(40)   NOT NULL,                 -- Eventor EventId, or club-defined id for legacy ("legacy-1998-vinter")
  SOURCE              VARCHAR(10)   NOT NULL DEFAULT 'legacy',-- 'eventor' | 'legacy'
  NAME                VARCHAR(255)  NOT NULL,
  EVENT_DATE          DATE          NULL,                    -- yyyy-mm-dd
  CLASSIFICATION_ID   VARCHAR(4)    NULL,                    -- 1..6 (Eventor EventClassificationId scale)
  LONGITUDE           DECIMAL(11,7) NOT NULL,                -- WGS-84 lon (x)
  LATITUDE            DECIMAL(10,7) NOT NULL,                -- WGS-84 lat (y)
  START_COUNT         INT           NULL,                    -- number of starters (optional)
  URL                 VARCHAR(500)  NULL,                    -- link to the event (Eventor page, result page, ...)
  ORDER_BY            INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (EVENT_ID, SOURCE),
  INDEX IDX_EVENTMAP_SOURCE (SOURCE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
