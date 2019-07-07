const sqlite3 = require('sqlite3').verbose();

export default class emailRepo
{
    constructor() {
        this.db = new sqlite3.Database('email.db');
    }

    addSubscription = (email, lists) => {
        var response;
        let sql = "SELECT * FROM Subscriptions WHERE Email_Address = '" + email + "'";
        this.db.get(sql, [], (err, row) => {
            if (err) {
                return console.error(err.message);
            }
            response = row ? true : false;
        });

        if (response) {
            let sql = "UPDATE Subscriptions SET Lists = '" + lists + "' WHERE email = '" + email + "'";
        }
        else {
            let sql = "INSERT INTO Subscriptions (Email_Address, Lists) VALUES ('" + email +"', '" + lists + "')";
        }

        this.db.run(sql, []);
        return true;
    }
}