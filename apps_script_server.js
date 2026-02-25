//https://docs.google.com/spreadsheets/d/1cfTUnyQZfy4-CTg0h2PQbyswqQMcR_yx5zzUK1bxVK8/edit?pli=1#gid=2009785461

const USERNAME = 0;
const PASSWORD = 1;

const MSTATION = 0;
const STATION = 1;
const EQUIP = 2;
const STATE = 3;
const EQID = 4;


const ss = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/1cfTUnyQZfy4-CTg0h2PQbyswqQMcR_yx5zzUK1bxVK8/edit?pli=1#gid=2009785461");

function doGet(request) {
    if (request.parameter.action == "AUTH") {
        let obj = {};
        try {
            const sheet = ss.getSheetByName('USERS');

            let data = sheet.getDataRange().getValues();
            obj = data.filter(user => {
                return user[USERNAME].toString() == request.parameter.username.toString() && user[PASSWORD].toString() == request.parameter.pass.toString();

            })
            if (obj.length != 0) {
                obj = [true, obj[0][2], obj[0][3]];
            }
            else {
                obj = [false, null, null];
            }
        }
        catch (e) {
            return ContentService.createTextOutput(JSON.stringify(e));

        }
        return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
    }
    if (request.parameter.action == "SETBREAKDOWN") {
        try {
            const sheet = ss.getSheetByName('EQ_BD');
            sheet.appendRow([request.parameter.eqid, request.parameter.breakdown])
            return ContentService.createTextOutput("true").setMimeType(ContentService.MimeType.TEXT);
        }
        catch (e) {
            return ContentService.createTextOutput("false").setMimeType(ContentService.MimeType.TEXT);
        }

    }

    if (request.parameter.action == "GETBREAKDOWNS") {
        let data;
        let filtered;
        let new_data = [];
        try {
            const sheet = ss.getSheetByName('EQ_BD')
            data = sheet.getDataRange().getValues();
            filtered = data.filter(bd => { return bd[0] == request.parameter.eqid })
            filtered.forEach(function (item, index) {
                new_data.push(item[1])
            });

        }
        catch (e) {
            return ContentService.createTextOutput(null).setMimeType(ContentService.MimeType.TEXT);
        }

        return ContentService.createTextOutput(JSON.stringify(new_data)).setMimeType(ContentService.MimeType.JSON);
    }


    if (request.parameter.action == "GETDATA") {
        let obj = {};
        try {
            const sheet = ss.getSheetByName('WELDSHOP');

            let data = sheet.getDataRange().getValues();
            let alert = data.map(row => {
                if (row[STATE].toString().trim() == "ALERT") {
                    return [row[MSTATION], row[STATION], row[EQID]]
                }

            })
            let ack = data.map(row => {
                if (row[STATE].toString().trim() == "ACK") {
                    return [row[MSTATION], row[STATION], row[EQID]]
                }

            })

            let f_alert = alert.filter(val => { return val != null });
            let f_ack = ack.filter(val => { return val != null });

            obj = { "ALERT": f_alert, "ACK": f_ack }

        }
        catch (e) {
            return ContentService.createTextOutput(null).setMimeType(ContentService.MimeType.TEXT);

        }
        return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
    }
    else if (request.parameter.action == "GETALERTSONLY") {
        let obj = {};
        try {
            const sheet = ss.getSheetByName('WELDSHOP');

            let data = sheet.getDataRange().getValues();

            obj = data.filter(row => {
                return row[3].toString().trim() == "ALERT";
            })
        }
        catch (e) {
            return ContentService.createTextOutput(JSON.stringify(e));
        }
        return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
    }
    else if (request.parameter.action == "SETALERT") {
        var date_obj = new Date();
        var date = date_obj.toLocaleDateString()
        if (request.parameter.substation != null && request.parameter.equipment != null && request.parameter.eqid != null) {
            try {
                const sheet = ss.getSheetByName('WELDSHOP');
                sheet.appendRow([request.parameter.mstation.toString(), request.parameter.substation.toString(), request.parameter.equipment.toString(), "ALERT", request.parameter.eqid.toString(), request.parameter.user, date, date_obj.toLocaleTimeString(), request.parameter.breakdown])
            }
            catch (e) {
                request = {}
            }
        }
        //return ContentService.createTextOutput(JSON.stringify(request)).setMimeType(ContentService.MimeType.TEXT);
    }
    else if (request.parameter.action == "SETACK") {
        if (request.parameter.station != null && request.parameter.eqid != null) {
            var date_obj = new Date();
            try {
                const sheet = ss.getSheetByName('WELDSHOP');
                let data = sheet.getDataRange().getValues();
                let index = 0;
                for (let i = 0; i <= data.length; i++) {
                    if (data[i][STATION].toString() == request.parameter.station.toString() && data[i][EQID].toString() == request.parameter.eqid.toString() && data[i][STATE].toString() == "ALERT") {
                        index = i + 1;
                        let query = "D" + index.toString();
                        let query2 = "K" + index.toString();
                        let query3 = "L" + index.toString();
                        let query4 = "M" + index.toString();

                        sheet.getRange(query.toString().trim()).setValue("ACK");
                        sheet.getRange(query2.toString().trim()).setValue(request.parameter.user);
                        sheet.getRange(query3.toString().trim()).setValue(date_obj.toLocaleDateString());
                        sheet.getRange(query4.toString().trim()).setValue(date_obj.toLocaleTimeString());

                        return ContentService.createTextOutput("true").setMimeType(ContentService.MimeType.TEXT);

                    }
                }
            }
            catch (e) {
                return ContentService.createTextOutput(JSON.stringify(e)).setMimeType(ContentService.MimeType.TEXT);

            }

        }
    }
    else if (request.parameter.action == "SETOK") {
        if (request.parameter.station != null && request.parameter.eqid != null) {
            var date_obj = new Date();
            try {
                const sheet = ss.getSheetByName('WELDSHOP');
                let data = sheet.getDataRange().getValues();
                let index = 0;
                for (let i = 0; i <= data.length; i++) {
                    if (data[i][STATION].toString() == request.parameter.station.toString() && data[i][EQID].toString() == request.parameter.eqid.toString() && data[i][STATE].toString() == "ACK") {
                        index = i + 1;
                        let query = "D" + index.toString();
                        let query2 = "N" + index.toString();
                        let query3 = "O" + index.toString();
                        let query4 = "P" + index.toString();
                        let query5 = "J" + index.toString();

                        sheet.getRange(query.toString().trim()).setValue("OK");
                        sheet.getRange(query2.toString().trim()).setValue(request.parameter.user);
                        sheet.getRange(query3.toString().trim()).setValue(date_obj.toLocaleDateString());
                        sheet.getRange(query4.toString().trim()).setValue(date_obj.toLocaleTimeString());
                        sheet.getRange(query5.toString().trim()).setValue(request.parameter.ica);
                        return ContentService.createTextOutput("true").setMimeType(ContentService.MimeType.TEXT);

                    }
                }
            }
            catch (e) {
                return ContentService.createTextOutput(JSON.stringify(e)).setMimeType(ContentService.MimeType.TEXT);

            }

        }
    }




}






