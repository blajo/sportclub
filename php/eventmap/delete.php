<?php
//############################################################
//# File:    delete.php                                      #
//# Created: 2026-06-01                                      #
//# Author:  JohBla                                          #
//# -------------------------------------------------------- #
//# Delete a single event from EVENTMAP_EVENTS (admin).    #
//# Body: { eventId, source }                                #
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
  trigger_error('User needs to be a administrator, to delete events.');
}

if (!isset($input->eventId) || trim($input->eventId) === '') {
  trigger_error('Felaktig parameter "eventId"', E_USER_ERROR);
}

$eventId = \db\mysql_real_escape_string($input->eventId);
$source = (isset($input->source) && $input->source === 'eventor') ? 'eventor' : 'legacy';

OpenDatabase();

$sqlDel = sprintf("DELETE FROM EVENTMAP_EVENTS WHERE EVENT_ID = '%s' AND SOURCE = '%s'", $eventId, $source);
\db\mysql_query($sqlDel) || trigger_error(sprintf('SQL-Error (%s)', substr($sqlDel, 0, 1024)), E_USER_ERROR);

CloseDatabase();

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
header("Access-Control-Allow-Headers: *");
header("Content-Type: application/json");

echo json_encode(array('eventId' => $input->eventId, 'source' => $source));

?>
