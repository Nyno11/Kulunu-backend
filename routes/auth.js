var express = require('express');
var app = express.Router();
var db = require('../config/db');
var mailer = require('../config/mailer');
var validation = require('../utils/validation');
var jwthelper = require('../utils/jwt_helper');
const axios = require('axios');

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const bcrypt = require("bcrypt");
const { verifyAccessToken } = require('../utils/jwt_helper');



db.on('error', e => {
    console.error('Database error', e);
    db = null;
});


//Check Email Validity 


app.post('/emailCheck', (req, res) => {
    try {
        let sql = `SELECT email FROM trial.users WHERE email=$1`;
        db.query(sql, [req.body.email], (err, result) => {
            if (err) {
                res.status(400).json({
                    success: false,
                    message: res.message,
                })
                return
            } console.log(result.rows.length)
            if (result.rowCount != 0) {
                res.status(400).json({
                    success: false,
                    message: "Email Exists"
                })
            } else {
                res.status(200).json({
                    success: true,
                    message: "Email Available"
                })
            }

        });
    } catch (err) {
        console.log(err);
        res.status(400).json({

            success: false,
            message: "An error occured"
        })

    }
});


// Get User

app.get('/getUser', jwthelper.verifyAccessToken, async (req, res) => {

    try {
        // Validation of authentication using Joi Library


        // const results = await db.query('select * from trial.users where email=$1 ', [req.body.email]);
        // console.table(results.rows);

        console.log(req.payload.aud);


        let sql = `select c.*, coalesce(p.id, s.id) as plan_id, coalesce(p.name, s.name) as plan_name
       ,  jsonb_build_object('longitude',trial.ST_X(c.location),'latitude',trial.ST_Y(c.location),'country',(select jsonb_build_object('id',o.id,'name',o.name,'flagurl',o.flagurl,'currency',o.currency,'currency_symbol',o.currency_symbol,'rate',o.rate,'longitude',o.longitude,'latitude',o.latitude )from trial.countries o  where  o.id=c.country_id ),'region',(select jsonb_build_object('id',r.id,'name',r.name,'country_id',r.country_id,'longitude',r.longitude,'latitude',r.latitude )from trial.regions r  where  r.id=c.region_id ),'city',(select jsonb_build_object('id',city.id,'name',city.name,'country_id',city.country_id,'region_id',city.country_id,'longitude',city.longitude,'latitude',city.latitude )from trial.cities city  where  city.id=c.region_id ) ) as userlocation
       ,array(select json_build_object('id',id,'name',name,'imageurl',imageurl,'variations',array(select jsonb_build_object('id',id,'name',name,'type',type,'setting',setting,'id_sport',id_sport)from trial.sport_variations v where v.id_sport=  b.id  ))from trial.sports b where b.id=  ANY(c.sports) )as usersports
		from trial.users c 	
		
		left join
             trial.personal_plans p  
             on p.id = c.plan_id and c.usertype='Personal' left join
             trial.organisation_plans s
             on s.id = c.plan_id and c.usertype = 'Organisation' where c.id_user=$1`;
        db.query(sql, [req.payload.aud], async (err, result) => {
            if (err) {
                res.status(400).send(err.message);

                return

            }

            if (result.rows.length > 0) {
                console.log(result.rows[0].password);




                res.status(200).json({
                    success: true,
                    data: {
                        id: result.rows[0]['id_user'],
                        name: result.rows[0]['name'],
                        email: result.rows[0]['email'],
                        image: result.rows[0]['image'],
                        handle: result.rows[0]['handle'],
                        usercolor: result.rows[0]['usercolor'],

                        about: result.rows[0]['about'],
                        ishost: result.rows[0]['ishost'],
                        sports: result.rows[0]['usersports'],
                        usertype: result.rows[0]['usertype'],
                        userlocation: result.rows[0]['userlocation'],
                        plan: {
                            id: result.rows[0]['plan_id'],
                            name: result.rows[0]['plan_name'],
                        },
                        // about: result[0]['about'],

                        // userimages: [result[0]['uimage_1'], result[0]['uimage_2'], result[0]['uimage_3'], result[0]['uimage_4']],

                    }




                });



            } else {
                console.log("sssss");
                res.status(400).json({
                    success: false,
                    message: "No user found!"
                })
            }

        });

    } catch (err) {
        console.log(err);
        res.status(400).json({

            success: false,
            message: "An error occured"
        })

    }
});





// Login User

app.post('/login', async (req, res) => {


    // Validation of authentication using Joi Library

    const { error } = validation.loginCheck(req.body)

    console.log(error)
    if (error) {
        res.json({
            success: false,
            message: error.details[0].message
        })
    } else {
        // const results = await db.query('select * from trial.users where email=$1 ', [req.body.email]);
        // console.table(results.rows);

        try {

            let sql = `select c.*, coalesce(p.id, s.id) as plan_id, coalesce(p.name, s.name) as plan_name
        ,  jsonb_build_object('longitude',trial.ST_X(c.location),'latitude',trial.ST_Y(c.location),'country',(select jsonb_build_object('id',o.id,'name',o.name,'flagurl',o.flagurl,'currency',o.currency,'currency_symbol',o.currency_symbol,'rate',o.rate,'longitude',o.longitude,'latitude',o.latitude )from trial.countries o  where  o.id=c.country_id ),'region',(select jsonb_build_object('id',r.id,'name',r.name,'country_id',r.country_id,'longitude',r.longitude,'latitude',r.latitude )from trial.regions r  where  r.id=c.region_id ),'city',(select jsonb_build_object('id',city.id,'name',city.name,'country_id',city.country_id,'region_id',city.country_id,'longitude',city.longitude,'latitude',city.latitude )from trial.cities city  where  city.id=c.region_id ) ) as userlocation
        ,array(select json_build_object('id',id,'name',name,'imageurl',imageurl,'variations',array(select jsonb_build_object('id',id,'name',name,'type',type,'setting',setting,'id_sport',id_sport)from trial.sport_variations v where v.id_sport=  b.id  ))from trial.sports b where b.id=  ANY(c.sports) )as usersports
		from trial.users c 	
		
		left join
             trial.personal_plans p  
             on p.id = c.plan_id and c.usertype='Personal' left join
             trial.organisation_plans s
             on s.id = c.plan_id and c.usertype = 'Organisation' where c.email=$1`;
            db.query(sql, [req.body.email], async (err, result) => {
                if (err) {
                    res.status(400).send(err);
                    console.log(err);
                    // res.send(error);
                    return

                }
                console.log(result[0]);
                if (result.rows.length > 0) {
                    console.log(result.rows[0].password);
                    const validPassword = await bcrypt.compare(req.body.password, result.rows[0].password);

                    if (!validPassword)
                        return res.status(400).json({

                            success: false,
                            message: "Password is wrong"
                        });


                    if (validPassword) {


                        var token = await jwthelper.signAccessToken(result.rows[0]['id_user'], req, res);
                        var refreshtoken = await jwthelper.signRefreshToken(result.rows[0]['id_user'], req, res);
                        console.log(token);
                        res.status(200).json({
                            success: true,
                            data: {
                                id: result.rows[0]['id_user'],
                                name: result.rows[0]['name'],
                                email: result.rows[0]['email'],
                                image: result.rows[0]['image'],
                                handle: result.rows[0]['handle'],
                                usercolor: result.rows[0]['usercolor'],
                                about: result.rows[0]['about'],
                                ishost: result.rows[0]['ishost'],
                                sports: result.rows[0]['usersports'],
                                usertype: result.rows[0]['usertype'],
                                userlocation: result.rows[0]['userlocation'],
                                plan: {
                                    id: result.rows[0]['plan_id'],
                                    name: result.rows[0]['plan_name'],
                                },
                                // about: result[0]['about'],

                                // userimages: [result[0]['uimage_1'], result[0]['uimage_2'], result[0]['uimage_3'], result[0]['uimage_4']],
                                token: token,
                                refreshtoken: refreshtoken,
                            },


                            message: "Logged in successfully",

                        });

                    }
                    else {
                        console.log("sssss");
                        res.status(400).json({
                            success: false,
                            message: "Wrong email or password!"
                        });
                    }


                } else {
                    console.log("sssss");
                    res.status(400).json({
                        success: false,
                        message: "No user found!"
                    })
                }

            });
        } catch (err) {
            console.log(err);
            res.status(400).json({

                success: false,
                message: "An error occured"
            })

        }
    }

});












//Register User



app.post('/register', (req, res) => {


    // Validation of authentication using Joi Library
    const { error } = validation.registerCheck(req.body)

    if (error) {
        res.status(400).json({
            success: false,
            message: error.details[0].message
        })
    } else {

        try {
            let sql = `SELECT email FROM trial.users WHERE email=$1`;
            db.query(sql, [req.body.email], async (err, result) => {
                if (err) {
                    res.status(400).json({
                        success: false,
                        message: "Server Error Occured, Try Again"
                    })
                    return
                }
                if (result.rows.length) {
                    res.status(400).json({
                        success: false,
                        message: "Email Exists, Kindly Login"
                    })
                } else {

                    let ip = req.headers['x-forwarded-for']?.split(',').shift() || req.ip || req.socket.remoteAddress;
                    console.log(ip);
                    var userlocation = await locator.getUserLocation("102.89.23.163");
                    console.log(userlocation.country_code)

                    let countryid = await db.query(`SELECT id FROM trial.countries WHERE iso2=$1`, [userlocation.country_code]);
                    console.log(countryid['rows'][0]['id'])
                    const salt = await bcrypt.genSalt(10);
                    const password = await bcrypt.hash(req.body.password, salt);
                    await mailer.sendEmailtoUser(req.body.email, "Hey there,welcome to Buzza", "Ready, Set, Game", "Happ to have you on board, wecome to Buzza").then((success) => {

                        // if (success) {
                        //     console.log('Email sent!');
                        //     res.status(200).json({

                        //         success: true,
                        //         message: "Reset email sent successful",

                        //     })

                        // } else {
                        //     res.status(400).json({
                        //         success: false,
                        //         message: "An error occured",
                        //     })
                        // }

                    });
                    let sql = "INSERT INTO trial.users (name,email,password,usertype,handle,country_id,region_id,latitude,longitude,location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,trial.ST_MakePoint(" + userlocation.longitude + "," + userlocation.latitude + " ));";
                    db.query(sql, [req.body.name, req.body.email, password, req.body.usertype, req.body.handle, userlocation.country_id, userlocation.region_id, userlocation.latitude, userlocation.longitude], (err, result) => {
                        if (err) {
                            res.status(400).json({
                                success: false,
                                message: err.message
                            });
                            return
                        }

                        sqlput = `SELECT c.*,    jsonb_build_object('longitude',trial.ST_X(c.location),'latitude',trial.ST_Y(c.location),'country',(select jsonb_build_object('id',o.id,'name',o.name,'flagurl',o.flagurl,'currency',o.currency,'currency_symbol',o.currency_symbol,'rate',o.rate,'longitude',o.longitude,'latitude',o.latitude )from trial.countries o  where  o.id=c.country_id ),'region',(select jsonb_build_object('id',r.id,'name',r.name,'country_id',r.country_id,'longitude',r.longitude,'latitude',r.latitude )from trial.regions r  where  r.id=c.region_id ),'city',(select jsonb_build_object('id',city.id,'name',city.name,'country_id',city.country_id,'region_id',city.country_id,'longitude',city.longitude,'latitude',city.latitude )from trial.cities city  where  city.id=c.region_id ) ) as userlocation
                    FROM trial.users c WHERE email=$1`;
                        db.query(sqlput, [req.body.email], async (err, result) => {

                            if (err) {
                                res.status(400).json({
                                    success: false,
                                    message: err.message
                                });
                                return
                            }

                            var token = await jwthelper.signAccessToken(result.rows[0]['id_user'], req, res);
                            var refreshtoken = await jwthelper.signRefreshToken(result.rows[0]['id_user'], req, res);
                            res.status(200).json({
                                success: true,
                                data: {
                                    id: result.rows[0]['id_user'],
                                    name: result.rows[0]['name'],
                                    email: result.rows[0]['email'],
                                    createdat: result.rows[0]['createdat'],
                                    usertype: result.rows[0]['usertype'],
                                    about: result.rows[0]['about'],
                                    handle: result.rows[0]['handle'],
                                    usercolor: result.rows[0]['usercolor'],
                                    ishost: result.rows[0]['ishost'],
                                    email: result.rows[0]['email'],
                                    imageUrl: result.rows[0]['image_url'],
                                    userlocation: result.rows[0]['userlocation'],
                                    token: token,
                                    refreshtoken: refreshtoken,
                                },

                            });
                        });


                    });

                }
            });
        } catch (err) {
            console.log(err);
            res.status(400).json({

                success: false,
                message: "An error occured"
            })

        }

    }

});


app.post('/setupaccount', jwthelper.verifyAccessToken, async (req, res) => {



    const { error } = validation.setupCheck(req.body)

    if (error) {
        res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    } else {
        try {



            db.query('UPDATE trial.users SET about=$1,sports=$2,dateofbirth=$3,gender=$4 WHERE id_user=$5', [req.body.about, req.body.sportsid, req.body.dateofbirth, req.body.gender, req.payload.aud], (err, result) => {
                if (err) {
                    res.status(400).json({
                        success: false,
                        message: err.message
                    });
                }

                sqlput = `select c.*, coalesce(p.id, s.id) as plan_id, coalesce(p.name, s.name) as plan_name
                            ,  jsonb_build_object('longitude',trial.ST_X(c.location),'latitude',trial.ST_Y(c.location),'country',(select jsonb_build_object('id',o.id,'name',o.name,'flagurl',o.flagurl,'currency',o.currency,'currency_symbol',o.currency_symbol,'rate',o.rate,'longitude',o.longitude,'latitude',o.latitude )from trial.countries o  where  o.id=c.country_id ),'region',(select jsonb_build_object('id',r.id,'name',r.name,'country_id',r.country_id,'longitude',r.longitude,'latitude',r.latitude )from trial.regions r  where  r.id=c.region_id ),'city',(select jsonb_build_object('id',city.id,'name',city.name,'country_id',city.country_id,'region_id',city.country_id,'longitude',city.longitude,'latitude',city.latitude )from trial.cities city  where  city.id=c.region_id ) ) as userlocation
                            ,array(select json_build_object('id',id,'name',name,'imageurl',imageurl,'variations',array(select jsonb_build_object('id',id,'name',name,'type',type,'setting',setting,'id_sport',id_sport)from trial.sport_variations v where v.id_sport=  b.id  ))from trial.sports b where b.id=  ANY(c.sports) )as usersports
                            from trial.users c 	
                            
                            left join
                                 trial.personal_plans p  
                                 on p.id = c.plan_id and c.usertype='Personal' left join
                                 trial.organisation_plans s
                                 on s.id = c.plan_id and c.usertype = 'Organisation' where c.id_userl=$1`;
                db.query(sqlput, [req.payload.aud], async (err, result) => {

                    if (err) {
                        res.status(400).json({
                            success: false,
                            message: err.message
                        });
                        return
                    }

                    var token = await jwthelper.signAccessToken(result.rows[0]['id_user'], req, res);
                    var refreshtoken = await jwthelper.signRefreshToken(result.rows[0]['id_user'], req, res);
                    res.status(200).json({
                        success: true,
                        data: {
                            id: result.rows[0]['id_user'],
                            name: result.rows[0]['name'],
                            email: result.rows[0]['email'],
                            image: result.rows[0]['image'],
                            handle: result.rows[0]['handle'],
                            usercolor: result.rows[0]['usercolor'],
                            about: result.rows[0]['about'],
                            ishost: result.rows[0]['ishost'],
                            sports: result.rows[0]['usersports'],
                            usertype: result.rows[0]['usertype'],
                            userlocation: result.rows[0]['userlocation'],
                            plan: {
                                id: result.rows[0]['plan_id'],
                                name: result.rows[0]['plan_name'],
                            },
                            // about: result[0]['about'],

                            // userimages: [result[0]['uimage_1'], result[0]['uimage_2'], result[0]['uimage_3'], result[0]['uimage_4']],
                            token: token,
                            refreshtoken: refreshtoken,
                        },
                        message: "Account setup successfully",
                    });
                })

            });






        } catch (err) {
            console.log(err);
            res.status(400).json({

                success: false,
                message: "An error occured"
            })

        }
    }
});


// Refresh User Token

app.post('/refreshToken', async (req, res, next) => {


    try {
        const { refreshToken } = req.body
        if (!refreshToken) {
            res.status(400).json({

                success: false,
                message: "Invalid refresh token"
            })

        }
        await jwthelper.verifyRefreshToken(refreshToken, req, res).then(async (userId) => {


            await jwthelper.signAccessToken(userId, req, res).then(async (newaccessToken) => {
                await jwthelper.signRefreshToken(userId, req, res).then(async (newrefreshToken) => {
                    res.status(200).json({
                        success: true,
                        message: "Token refresh successful",
                        data: {
                            accessToken: newaccessToken,
                            refreshToken: newrefreshToken
                        }
                    })


                })
            })

        })

    } catch (err) {
        console.log(err);
        res.status(400).json({

            success: false,
            message: "An error occured"
        })

    }

});



// Change Password

app.post('/changepass', jwthelper.verifyAccessToken, async (req, res) => {


    const { error } = validation.changePassCheck(req.body)

    if (error) {
        res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    } else {

        try {
            var s = req.payload;
            console.log(s.user.id_user)
            db.query('SELECT password FROM trial.users WHERE id_user=$1', [s.user.id_user], async (err, result) => {
                if (err) {
                    res.status(400).json({
                        success: false,
                        message: err.message
                    });
                }
                console.log(result.rows[0].password);
                const validPassword = await bcrypt.compare(req.body.oldpassword, result.rows[0].password);

                if (!validPassword)
                    return res.status(400).json({

                        success: false,
                        message: "Password is wrong"
                    });

                if (validPassword) {
                    if (req.body.newpassword == req.body.oldpassword) {
                        res.status(400).json({
                            success: false,
                            message: "New password cannot be the same as old",
                        })
                    }
                    if (req.body.newpassword == req.body.newpasswordrepeat) {

                        if (req.body.newpassword.length >= 6 && req.body.newpassword.length <= 60) {

                            const salt = await bcrypt.genSalt(10);
                            const password = await bcrypt.hash(req.body.newpassword, salt);

                            db.query('UPDATE trial.users SET password=$1 WHERE id_user=$2', [password, s['user']['id_user']], async (err, result) => {
                                if (err) {
                                    res.status(400).json({
                                        success: false,
                                        message: err.message
                                    });
                                }

                                res.status(200).json({
                                    success: true,
                                    message: "Password Updated Successfully",
                                })
                            });
                        } else {
                            res.status(400).json({
                                success: false,
                                message: "Invalid Password Length",
                            })
                        }

                    } else {
                        res.status(400).json({
                            success: false,
                            message: "Passwords do not match",
                        })


                    }



                } else {
                    res.status(400).json({
                        success: false,
                        message: "An error occured",
                    })
                    console.log('{ "Error": "Invalid name or password!" }');

                    console.log("error");
                }

            });
        } catch (err) {
            console.log(err);
            res.status(400).json({

                success: false,
                message: "An error occured"
            })

        }
    }
});


// Reset User Password with provided token

app.post('/resetpassword', async (req, res) => {



    const { error } = validation.resetPassCheck(req.body)

    if (error) {
        res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    } else {
        try {

            if (req.body.newpassword == req.body.newpasswordrepeat) {

                if (req.body.newpassword.length >= 6 && req.body.newpassword.length <= 60) {
                    const salt = await bcrypt.genSalt(10);
                    const password = await bcrypt.hash(req.body.newpassword, salt);
                    await jwthelper.verifyPasswordToken(req.body.token, req, res).then(async (userId) => {
                        console.log(userId);

                        db.query('UPDATE trial.users SET password=$1 WHERE id_user=$2', [password, userId], async (err, result) => {
                            if (err) {
                                res.status(400).json({
                                    success: false,
                                    message: err.message
                                });
                            }
                            res.status(200).json({
                                success: true,
                                message: "Password reset successfully",
                            })
                        });



                    });
                }
                else {
                    res.status(400).json({
                        success: false,
                        message: "Invalid Password length",
                    })
                }

            } else {
                res.status(400).json({
                    success: false,
                    message: "Passwords do not match",
                })
            }


        } catch (err) {
            console.log(err);
            res.status(400).json({

                success: false,
                message: "An error occured"
            })

        }
    }
});




// Send Email to reset password


app.post('/sendresetemail', (req, res) => {


    try {

        var email = req.body.email;




        db.query('SELECT id_user FROM trial.users WHERE email=$1', [email], async (err, result) => {
            console.log(result.rows[0].id_user)

            if (err) {
                res.status(400).json({
                    success: false,
                    message: err.message
                });
            }

            await jwthelper.signPasswordToken(result.rows[0].id_user, req, res).then(async (passwordToken) => {

                console.log(passwordToken);
                await mailer.sendEmailtoUser(email, "Password Reset", "You requested a password reset", "<a style='font-size:12px;line-height:14px;text-align:center;color:#50a1f7'  target='_blank' href='https://localhost/trial/change-password.php?token=" + passwordToken + "'>https://localhost/trial/change-password?token=$token</a>").then((success) => {



                    if (success) {
                        console.log('Email sent!');
                        res.status(200).json({

                            success: true,
                            message: "Reset email sent successful",

                        })

                    } else {
                        res.status(400).json({
                            success: false,
                            message: "An error occured",
                        })
                    }

                });

            })
        });

    } catch (err) {
        console.log(err);
        res.status(400).json({

            success: false,
            message: "An error occured"
        })

    }
});







app.post('/googleAuthLogin', async (req, res) => {





    try {





        const ticket = await client.verifyIdToken({
            idToken: req.body.token,
            audience: [process.env.ANDROID_CLIENT_ID, process.env.IOS_CLIENT_ID, process.env.GOOGLE_CLIENT_ID],
        });
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        // If request specified a G Suite domain:
        // const domain = payload['hd'];
        console.log(payload["email"]);
        if (payload["email"] != null) {



            var emailVerified = payload["email_verified"];
            var name = payload["name"];
            var imageUrl = payload["picture"];
            var given_name = payload["given_name"];
            var family_name = payload["family_name"];
            var locale = payload["locale"];
            var usertype = req.body.usertype;


            var email = payload["email"];
            //SIGN IN

            let sql = `select * from trial.users where email=$1`;
            db.query(sql, [email], async (err, result) => {
                if (err) {
                    res.status(400).send(err);

                    return

                }

                if (result.rows.length > 0) {







                    var token = await jwthelper.signAccessToken(result.rows[0]['id_user'], req, res);
                    var refreshtoken = await jwthelper.signRefreshToken(result.rows[0]['id_user'], req, res);
                    console.log(result.rows[0]['name']);
                    res.status(200).json({
                        success: true,
                        data: {
                            id: result.rows[0]['id_user'],
                            name: result.rows[0]['name'],
                            email: result.rows[0]['email'],
                            createdat: result.rows[0]['createdat'],
                            usertype: result.rows[0]['usertype'],
                            // about: result[0]['about'],
                            handle: result.rows[0]['handle'],
                            email: result.rows[0]['email'],
                            imageUrl: result.rows[0]['image_url'],

                            // about: result[0]['about'],

                            // userimages: [result[0]['uimage_1'], result[0]['uimage_2'], result[0]['uimage_3'], result[0]['uimage_4']],
                            token: token,
                            refreshtoken: refreshtoken,
                        },
                        message: "Signed In successfully"


                    });




                } else {

                    res.status(400).json({
                        success: false,
                        message: "User doesn't exists, kindly register"
                    });




                }
            });
        }
    } catch (error) {
        console.log(error.message);
        res.status(400).json({
            success: false,
            message: "Unable to sign in with Google"
        })
    }

});



app.post('/googleAuthRegister', async (req, res) => {





    try {





        const ticket = await client.verifyIdToken({
            idToken: req.body.token,
            audience: [process.env.ANDROID_CLIENT_ID, process.env.IOS_CLIENT_ID, process.env.GOOGLE_CLIENT_ID],
        });
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        // If request specified a G Suite domain:
        // const domain = payload['hd'];
        console.log(payload["email"]);
        if (payload["email"] != null) {



            var emailVerified = payload["email_verified"];
            var name = payload["name"];
            var imageUrl = payload["picture"];
            var given_name = payload["given_name"];
            var family_name = payload["family_name"];
            var locale = payload["locale"];
            var usertype = req.body.usertype;


            var email = payload["email"];
            //SIGN IN

            let sql = `select * from trial.users where email=$1`;
            db.query(sql, [email], async (err, result) => {
                if (err) {
                    res.status(400).send(err);

                    return

                }

                if (result.rows.length == 0) {





                    let ip = req.headers['x-forwarded-for']?.split(',').shift() || req.ip || req.socket.remoteAddress;
                    console.log(ip);
                    var userlocation = await locator.getUserLocation("102.89.23.163");
                    console.log(userlocation.country_code)

                    let countryid = await db.query(`SELECT id FROM trial.countries WHERE iso2=$1`, [userlocation.country_code]);
                    console.log(countryid['rows'][0]['id'])


                    let sql = `INSERT INTO trial.users (name,email,password,usertype,country_id,latitude,longitude) VALUES ($1,$2,$3,$4,$5,$6,$7);`;
                    db.query(sql, [name, email, 'GOOGLE_AUTH', usertype, countryid['rows'][0]['id'], userlocation.latitude, userlocation.longitude], (err, result) => {
                        if (err) {
                            res.status(400).json({
                                success: false,
                                message: err.message
                            });
                            return
                        }

                        sqlput = `SELECT * FROM trial.users WHERE email=$1`;
                        db.query(sqlput, [email], async (err, result) => {

                            if (err) {
                                res.status(400).json({
                                    success: false,
                                    message: err.message
                                });
                                return
                            }

                            var token = await jwthelper.signAccessToken(result.rows[0]['id_user'], req, res);
                            var refreshtoken = await jwthelper.signRefreshToken(result.rows[0]['id_user'], req, res);
                            res.status(200).json({
                                success: true,
                                data: {
                                    id: result.rows[0]['id_user'],
                                    name: result.rows[0]['name'],
                                    email: result.rows[0]['email'],
                                    createdat: result.rows[0]['createdat'],
                                    usertype: result.rows[0]['usertype'],
                                    // about: result[0]['about'],
                                    handle: result.rows[0]['handle'],
                                    email: result.rows[0]['email'],
                                    imageUrl: result.rows[0]['image_url'],
                                    token: token,
                                    refreshtoken: refreshtoken,
                                },

                            });
                        });


                    });

                } else {
                    res.status(400).json({
                        success: false,
                        message: "User already exists, kindly login"
                    })
                }

            });





        }
    } catch (error) {
        console.log(error.message);
        res.status(400).json({
            success: false,
            message: "Unable to sign in with Google"
        })
    }

});

///////////////////////////////////////////////////////////////////

app.post('/verifyRecOTP', (req, res) => {

    try {
        let sql = `SELECT email FROM trial.users WHERE email=$1`;
        db.query(sql, [req.body.email], (err, result) => {
            if (err) {
                res.status(400).json({
                    success: false,
                    message: "Server Error"
                });
                return
            }



            let sql = `SELECT user_email,otp_pass FROM otp WHERE user_email=$1 AND otp_pass=$1`;
            db.query(sql, [req.body.email, req.body.otp], (err, result) => {
                if (err) {
                    res.status(400).json({
                        success: false,
                        message: "Server Error"
                    });
                    return
                }


                if (result.length) {
                    let sqldel = `DELETE FROM otp WHERE user_email=$1 AND otp_pass=$1`;
                    db.query(sqldel, [req.body.email, req.body.otp], (err, result) => {
                        if (err) {
                            res.status(400).json({
                                success: false,
                                message: "Server Error"
                            });
                            return
                        } else {
                            res.status(200).json({
                                success: true,
                                message: "OTP Verified Successfully",
                            })
                            return

                        }

                    });

                } else {
                    res.status(400).json({
                        success: true,
                        message: "Wrong OTP",
                    })
                }



            });



        });
    } catch (err) {
        console.log(err);
        res.status(400).json({

            success: false,
            message: "An error occured"
        })

    }

});




module.exports = app;