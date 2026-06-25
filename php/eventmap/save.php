<?php
//############################################################
//# File:    save.php                                        #
//# Created: 2026-06-01                                      #
//# Author:  JohBla                                          #
//# -------------------------------------------------------- #
//# Save events into EVENTMAP_EVENTS (admin only).           #
//# Used both for hand-entered legacy events and for the     #
//# Eventor sync. Body:                                      #
//#   { events: IEvent[], removedEventIds: [{eventId,source}]}#
//############################################################

include_once($_SERVER["DOCUMENT_ROOT"] . "/include/db.php");
include_once($_SERVER["DOCUMENT_ROOT"] . "/include/users.php");
include_once($_SERVER["DOCUMENT_ROOT"] . "/include/functions.php");

cors();
ValidLogin();

header("Cache-Control: no-cache, must-revalidate");
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");

$json = file_get_contents('php://input');
$input = json_decode($json);

if (!(ValidGroup($cADMIN_GROUP_ID)))
{
  trigger_error('User needs to be a administrator, to update events.');
}

if (!isset($input->events) || !is_array($input->events)) {
  trigger_error('Felaktig parameter "events"', E_USER_ERROR);
}

OpenDatabase();

foreach ($input->events as $i => $e) {
  if (!isset($e->eventId) || trim($e->eventId) === '') {
    trigger_error('Felaktig parameter "eventId" för event index ' . $i, E_USER_ERROR);
  }
  if (!isset($e->name) || trim($e->name) === '') {
    trigger_error('Felaktig parameter "name" för event index ' . $i, E_USER_ERROR);
  }
  if (!isset($e->longitude) || !isset($e->latitude)) {
    trigger_error('Felaktig parameter "longitude"/"latitude" för event index ' . $i, E_USER_ERROR);
  }

  $source = (isset($e->source) && $e->source === 'eventor') ? 'eventor' : 'legacy';

  $eventId = \db\mysql_real_escape_string($e->eventId);
  $name = \db\mysql_real_escape_string($e->name);
  $longitude = floatval($e->longitude);
  $latitude = floatval($e->latitude);
  $orderBy = isset($e->orderBy) ? intval($e->orderBy) : intval($i);

  $date = (isset($e->date) && trim($e->date) !== '')
    ? "'" . \db\mysql_real_escape_string($e->date) . "'"
    : 'NULL';
  $classificationId = (isset($e->classificationId) && trim((string)$e->classificationId) !== '')
    ? "'" . \db\mysql_real_escape_string((string)$e->classificationId) . "'"
    : 'NULL';
  $startCount = (isset($e->startCount) && $e->startCount !== null && $e->startCount !== '')
    ? strval(intval($e->startCount))
    : 'NULL';
  $url = (isset($e->url) && trim($e->url) !== '')
    ? "'" . \db\mysql_real_escape_string($e->url) . "'"
    : 'NULL';
  $eventStatus = (isset($e->eventStatus) && trim((string)$e->eventStatus) !== '')
    ? "'" . \db\mysql_real_escape_string((string)$e->eventStatus) . "'"
    : 'NULL';

  $sql = sprintf(
    "INSERT INTO EVENTMAP_EVENTS (EVENT_ID, SOURCE, NAME, EVENT_DATE, CLASSIFICATION_ID, LONGITUDE, LATITUDE, START_COUNT, URL, ORDER_BY, EVENT_STATUS) " .
    "VALUES ('%s', '%s', '%s', %s, %s, %F, %F, %s, %s, %d, %s) " .
    "ON DUPLICATE KEY UPDATE NAME = '%s', EVENT_DATE = %s, CLASSIFICATION_ID = %s, LONGITUDE = %F, LATITUDE = %F, START_COUNT = %s, URL = %s, ORDER_BY = %d, EVENT_STATUS = %s",
    $eventId, $source, $name, $date, $classificationId, $longitude, $latitude, $startCount, $url, $orderBy, $eventStatus,
    $name, $date, $classificationId, $longitude, $latitude, $startCount, $url, $orderBy, $eventStatus
  );

  \db\mysql_query($sql) || trigger_error(sprintf('SQL-Error (%s)', substr($sql, 0, 1024)), E_USER_ERROR);
}

if (isset($input->removedEventIds) && is_array($input->removedEventIds)) {
  foreach ($input->removedEventIds as $r) {
    if (!isset($r->eventId) || trim($r->eventId) === '') continue;
    $rid = \db\mysql_real_escape_string($r->eventId);
    $rsource = (isset($r->source) && $r->source === 'eventor') ? 'eventor' : 'legacy';
    $sqlDel = sprintf("DELETE FROM EVENTMAP_EVENTS WHERE EVENT_ID = '%s' AND SOURCE = '%s'", $rid, $rsource);
    \db\mysql_query($sqlDel) || trigger_error(sprintf('SQL-Error (%s)', substr($sqlDel, 0, 1024)), E_USER_ERROR);
  }
}

CloseDatabase();

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
header("Access-Control-Allow-Headers: *");
header("Content-Type: application/json");

echo json_encode($input);

?>
