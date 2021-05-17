import express from 'express'
const PORT = process.env.PORT || 5000

import {Entry, serializeEntries, deserializeEntries} from './public/entries.js'

import postgres from 'postgres'
const sql = (process.env.DATABASE_URL == undefined) ? null : postgres(process.env.DATABASE_URL)

export type Credentials = {username: string, hashedPassword: string}

async function signup(credentials:Credentials): Promise<void> {
    await sql`INSERT INTO users (name, password_hash)
                VALUES (
                ${credentials.username},
                ${credentials.hashedPassword}
                )`
}

async function userExists(credentials:Credentials): Promise<boolean> {
    const results = await sql`SELECT * FROM users
        WHERE name=${credentials.username}
        AND password_hash=${credentials.hashedPassword}`
    return (results.length > 0)
}

async function updateEntry(credentials:Credentials, entry:Entry): Promise<void> {
    await sql`INSERT INTO entries (username, time, before, after, lastModified, id, deleted
        VALUES (
            ${credentials.username},
            ${entry.time},
            ${entry.before || null},
            ${entry.after || null},
            ${entry.lastModified.getTime()},
            ${entry.deleted}
        )
        ON CONFLICT(uniqueness) DO UPDATE SET
            before = EXCLUDED.before,
            after = EXCLUDED.after,
            time = EXCLUDED.time,
            lastModified = EXCLUDED.lastModified,
            deleted = EXCLUDED.deleted
        WHERE
            lastModified < EXCLUDED.lastModified
    `
}

async function getEntries(credentials:Credentials): Promise<Entry[]> {
    const rows = await sql`SELECT (time, before, after, lastModified, deleted) from entries WHERE username = ${credentials.username}`
    return rows.map((row:any) => ({
        time: new Date(row.time as number),
        before: (row.before || undefined) as string|undefined,
        after: (row.after || undefined) as string|undefined,
        lastModified: new Date(row.lastModified as number),
        deleted: row.deleted as boolean,
    }))
}

express()
    .get('/test', async (req: any, res: any) => {
        res.send('Hello, world!')
    })
    .use(express.static('./public'))
    .post('/signup', async (req: any, res:any) => {
        const credentials:Credentials = {
          username:req.query.username,
          hashedPassword:req.query.hashedPassword
        }
        if (credentials.username.length < 1) {
          res.send('Non-empty username required')
        } else if (credentials.hashedPassword.length < 1) {
          res.send("Non-empty password hash required (shouldn't be possible)")
        } else {
          try {
            await signup(credentials)
            res.send('ok')
          } catch (e) {
              console.log(e)
            res.send(e)
          }
        }
      })
    .post('/login', async (req: any, res:any) => {
    const credentials:Credentials = {
        username:req.query.username,
        hashedPassword:req.query.hashedPassword
    }
    try {
        const success:boolean = await userExists(credentials)
        if (success) {
        res.send('ok')
        } else {
        res.send('username+password not found')
        }
    } catch (e) {
        res.send(e)
    }
    })
    .post('/update', async (req: any, res:any) => {
        const credentials:Credentials = {
            username:req.query.username,
            hashedPassword:req.query.hashedPassword
        }
        try {
            const success:boolean = await userExists(credentials)
            if (success) {
                const entries = deserializeEntries(req.query.entries)
                for (const entry of entries) {
                    updateEntry(credentials, entry)
                }
            } else {
                res.send('username+password not found')
            }
        } catch (e) {
            res.send(e)
        }
    })
    .get('/entries', async (req: any, res:any) => {
        const credentials:Credentials = {
            username:req.query.username,
            hashedPassword:req.query.hashedPassword
        }
        try {
            const success:boolean = await userExists(credentials)
            if (success) {
                const entries = await getEntries(credentials)
                res.send(serializeEntries(entries))
            } else {
                res.send('username+password not found')
            }
        } catch (e) {
            res.send(e)
        }
    })
    .listen(PORT, () => console.log(`Listening on ${ PORT }`))