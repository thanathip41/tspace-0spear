import autocannon , { Result } from 'autocannon'
import Fastify from 'fastify'
import express, { Request, Response } from 'express'
import http from 'http'
import yargs from 'yargs';
import Spear from "../lib"

const MESSAGE = 'Hello world!'

const { argv } : Record<string,any> = yargs(process.argv.slice(2))
let duration = argv.d || argv.duration
let connections = argv.c || argv.connections
let pipelining = argv.p || argv.pipelining

connections = connections == null ? 100 : Number(connections)
pipelining  = pipelining == null ? 10 : Number(pipelining)
duration    = duration == null ? 10 : Number(duration)

function runExpress () {
    
    const port = 3000;
    
    express()
    .get('/', (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/plain');
        return res.send(MESSAGE);
    })
    .listen(port, () => {
        console.log(`Server 'Express' running at http://localhost:${port}`);
    });
}

function runHttp () {
    const port = 3001;
    const server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end(MESSAGE);
    });

    server.listen(port, () => {
        console.log(`Server 'Http' running at http://localhost:${port}`);
    });
}

function runFastify () {
    const port = 3002

    Fastify()
    .get('/', (request, reply) => {
        return reply
        .header('Content-Type', 'text/plain')
        .send(MESSAGE);
    })
    .listen({ port }, (err, address) => {
        if (err) throw err
        console.log(`server 'Fastify' running at : http://localhost:${port}`)
    })
}



function runSpear () {
    const port = 3003

    new Spear()
    .get('/' , ({ res }) => MESSAGE)
    .listen(port , () => 
        console.log(`server 'Spear' running at : http://localhost:${port}`)
    )
}

const url = (port : number) => `http://localhost:${port}`

const urls = [
    { name: 'express',      url: url(3000)},
    { name: 'http',         url: url(3001)},
    { name: 'fastify',      url: url(3002)},
    { name: 'tspace-spear', url: url(3003)}
];

const sleep = (ms : number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const runBenchmark = async () : Promise<void> => {

    const results : any[] = [];

    for (const { name, url } of urls) {
        const result : Result  = await new Promise((resolve, reject) => {
            autocannon({
                url,
                connections,
                duration,
                pipelining
            }, (err, result) => {

                if (err) return reject(err);

                return resolve(result);

            });
        })

        results.push({ 
            name,
            url,
            requests : result.requests.total, 
            average  : result.latency.average
        });
    }

    console.log({
        connections,
        duration,
        pipelining
    })

    console.table(results);
}

async function runApps() {

    await Promise.all([
        runSpear,
        runFastify,
        runExpress,
        runHttp
    ].map(v => v()))

    await sleep(3000)
    console.log('benchmarking !!')
    await runBenchmark()

    console.log('benchmarking done !!')
}

runApps()



