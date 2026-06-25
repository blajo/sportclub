<?php
//############################################################
//# File:    jsonEventMapQuery.php                           #
//# Created: 2026-06-01                                      #
//# Author:  JohBla                                          #
//# -------------------------------------------------------- #
//# Returns all events (eventor + legacy) for the map, read  #
//# only from the database. No call to Eventor here.         #
//############################################################

include_once($_SERVER["DOCUMENT_ROOT"] . "/include/db.php");
include_once($_SERVER["DOCUMENT_ROOT"] . "/include/functions.php");
include_once($_SERVER["DOCUMENT_ROOT"] . "/include/users.php");

cors();

$json = file_get_contents('php://input');
$input = json_decode($json);

OpenDatabase();

$sql = "SELECT EVENT_ID, SOURCE, NAME, DATE_FORMAT(EVENT_DATE, '%Y-%m-%d') AS EVENT_DATE, CLASSIFICATION_ID, LONGITUDE, LATITUDE, START_COUNT, URL, ORDER_BY, EVENT_STATUS FROM EVENTMAP_EVENTS ORDER BY EVENT_DATE ASC, ORDER_BY ASC";
$result = \db\mysql_query($sql);
if (!$result)
{
  trigger_error('SQL Error: ' . \db\mysql_error() . ' SQL: ' . $sql, E_USER_ERROR);
}

$rows = array();
if (\db\mysql_num_rows($result) > 0) {
  while($row = \db\mysql_fetch_assoc($result)) {
    $x = new stdClass();
    $x->eventId = $row['EVENT_ID'];
    $x->source = $row['SOURCE'];
    $x->name = $row['NAME'];
    $x->date = is_null($row['EVENT_DATE']) ? null : $row['EVENT_DATE'];
    $x->classificationId = is_null($row['CLASSIFICATION_ID']) ? null : $row['CLASSIFICATION_ID'];
    $x->longitude = floatval($row['LONGITUDE']);
    $x->latitude = floatval($row['LATITUDE']);
    $x->startCount = is_null($row['START_COUNT']) ? null : intval($row['START_COUNT']);
    $x->url = is_null($row['URL']) ? null : $row['URL'];
    $x->orderBy = intval($row['ORDER_BY']);
    $x->eventStatus = is_null($row['EVENT_STATUS']) ? null : $row['EVENT_STATUS'];
    array_push($rows, $x);
  }
}

\db\mysql_free_result($result);
CloseDatabase();

header("Content-Type: application/json");
ini_set('precision', 20);
ini_set('serialize_precision', 14);
echo json_encode($rows);

?>
