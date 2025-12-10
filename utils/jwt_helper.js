import JWT from 'jsonwebtoken';

export default {
    signAccessToken: (userId, req, res) => {
        return new Promise((resolve, reject) => {
            const payload = {}
            const secret = process.env.ACCESS_TOKEN_SECRET
            const options = {
                expiresIn: '60d',
                issuer: 'Kulunu.app',
                audience: userId.toString(),
            }
            try {
                JWT.sign(payload, secret, options, (err, token) => {
                    if (err) {
                        console.log(err.message)
                        return reject(res.status(500).json({

                            success: false,
                            message: "Internal Server Error"
                        }))

                    }

                    return resolve(token)
                })
            } catch (err) {
                console.log(err);
                return reject(res.status(500).json({

                    success: false,
                    message: "Internal Server Error"
                }))
            }

        })
    },
    verifyAccessToken: (req, res, next) => {
        if (!req.headers['authorization']) return next(res.status(401).json({

            success: false,
            message: "Unauthorised"
        }))
        const authHeader = req.headers['authorization']
        const bearerToken = authHeader.split(' ')
        const token = bearerToken[1]
        try {

            JWT.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
                if (err) {
                    console.log(err);
                    const message =
                        err.name === 'JsonWebTokenError' ? 'Unauthorized' :
                            err.name === 'TokenExpiredError' ? 'Token Expired' : err.message
                    return next(res.status(401).json({
                        success: false,
                        message: message
                    }))
                }
                req.payload = payload
                next()
            })
        } catch (err) {
            console.log(err);
            res.status(500).json({

                success: false,
                message: "Internal Server Error"
            })
        }
    },
    signRefreshToken: (userId, req, res) => {
        return new Promise((resolve, reject) => {
            const payload = {}
            const secret = process.env.REFRESH_TOKEN_SECRET
            const options = {
                expiresIn: '1y',
                issuer: 'Kulunu.app',
                audience: userId.toString(),
            }
            JWT.sign(payload, secret, options, async (err, token) => {
                if (err) {
                    console.log(err.message)
                    // reject(err)
                    reject(res.status(500).json({

                        success: false,
                        message: "Internal Server Error"
                    }))
                }


                // client.ZREMRANGEBYSCORE(userId.toString(), 0, parseInt((Date.now() / 1000).toFixed(0)), {


                // }).then((err) => {
                //     console.log(err + "Rooo")
                //     if (err != 1) {

                //     }

                // })

                // client.ZADD(userId.toString(), [{ score: (parseInt((Date.now() / 1000).toFixed(0)) + (365 * 24 * 60 * 60)), value: token }], {
                //     EX: (365 * 24 * 60 * 60),

                // }).then((err) => {
                //     console.log(err + "Rrr")
                //     if (err != 1) {

                //         return reject(res.status(500).json({

                //             success: false,
                //             message: "Internal Server Error"
                //         }))

                //     }
                //     return resolve(token)

                // })
                return resolve(token)
            })

        })
    },
    verifyRefreshToken: (refreshToken, req, res) => {
        return new Promise((resolve, reject) => {
            JWT.verify(
                refreshToken,
                process.env.REFRESH_TOKEN_SECRET,
                async (err, payload) => {
                    // console.log(err)
                    if (err) {
                        return reject(res.status(401).json({

                            success: false,
                            message: "Unauthorised, please login afresh"
                        }))

                    }
                    const userId = payload.aud
                    // await client.ZRANK(userId, refreshToken).then(async (err) => {
                    // console.log(err);


                    // if (err != null) return resolve(userId)
                    // await client.ZREM(userId, refreshToken).then((err) => {
                    //     console.log(err + "RERr");


                    //     if (err != 0) return resolve(userId)
                    //     return reject(res.status(401).json({

                    //         success: false,
                    //         message: "Unauthorised, please login dff afresh"
                    //     }))
                    // })
                    // return reject(res.status(401).json({

                    //     success: false,
                    //     message: "Unauthorised, please logine ee afresh"
                    // }))
                    // })


                }
            )
        })
    },



    //PASSWORD TOKENS

    signPasswordToken: (userId, req, res) => {
        return new Promise((resolve, reject) => {
            const payload = {}
            const secret = process.env.REFRESH_TOKEN_SECRET
            const options = {
                expiresIn: 60 * 10,
                issuer: 'Kulunu.app',
                audience: userId.toString(),
            }
            JWT.sign(payload, secret, options, async (err, token) => {
                if (err) {
                    console.log(err.message)
                    // reject(err)
                    reject(res.status(500).json({

                        success: false,
                        message: "Internal Server Error"
                    }))
                }




                // client.SET('password' + userId.toString(), token, {
                //     EX: (10 * 60),

                // }).then((err) => {
                //     console.log(err + "Rrr")
                //     if (err != 'OK') {

                //         return reject(res.status(500).json({

                //             success: false,
                //             message: "Internal Server Error"
                //         }))

                //     }
                return resolve(token)

                // })

            })

        })
    },
    verifyPasswordToken: (passwordToken, req, res) => {
        return new Promise((resolve, reject) => {
            JWT.verify(
                passwordToken,
                process.env.REFRESH_TOKEN_SECRET,
                async (err, payload) => {
                    console.log(err)
                    if (err) {
                        return reject(res.status(401).json({

                            success: false,
                            message: "Unauthorised, please login afresh"
                        }))

                    }
                    const userId = payload.aud
                    // await client.GET('password' + userId).then(async (err) => {
                    //     console.log(err);


                    // if (err != null) return resolve(userId)
                    // if (err == passwordToken) {
                    //         await client.DEL(['password' + userId]).then((err) => {
                    //             console.log(err + "RERr");


                    //             return resolve(userId)


                    //         })
                    //     } else {


                    //         return reject(res.status(401).json({

                    //             success: false,
                    //             message: "Unauthorised, please reset password "
                    //         }))
                    //     }

                    // })



                }
            )
        })
    },
}