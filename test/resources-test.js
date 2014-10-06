var superagent = require('superagent')
var child_process = require('child_process');
var path = require('path');
var expect = require('expect.js')
var logger = require('../app/util/logger');
var mysql = require('mysql');
var fs = require('fs');

var connectionHelper = require('./util/connection-helper');

var nconf = require('nconf');
nconf.argv().env();

logger.setLevel(logger.INFO);
logger.setTarget("file", __dirname + "/../logs/output.log");

var server_port = 9002;
var hostname = 'localhost';

if (nconf.get("port")) {
    server_port = +nconf.get("port");
}
if (nconf.get("hostname")) {
    hostname = nconf.get("hostname");
}

var RANDOM_ID = (new Date()).getTime() % (2048 * 2048);


describe('REST Services tests', function (done) {
    before(function (done) {
        logger.log(logger.INFO, "Reading SQL contents...");
        var contents = fs.readFileSync('test/dbscript/initial-data.sql', { encoding: 'utf-8' }).toString();
        
        var connection = mysql.createConnection({
            host     : 'localhost',
            user     : 'tester',
            password : 'tester',
            database : 'unittest'
        });
        
        var count = 0;
        var totalCount = connectionHelper.loadFromFile(connection, contents, function () {
            count++;
        });
        connection.end();
        var child = child_process.fork(__dirname + "/../app/server", [], {
            cwd: "..",
            env: {
                database: "test",
                port: server_port
            }
        });
        
        child.on("message", function (m) {
            if (m && m === "SERVER_STARTED") {
                logger.log(logger.INFO, "Received message that server is successfully started...");
                var f = function () {
                    setTimeout(function () {
                        if (totalCount && count === totalCount) {
                            done();
                        } else {
                            logger.log(logger.INFO, "Server started but SQL statements are still executing...");
                            f();
                        }
                    }, 150);
                }
                f();
            }
        });

    });
    
    describe('Preference REST API tests', function (done) {
    });
    
    describe('Country REST API tests', function (done) {
        
        it('GET Collection with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/countries')
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(200);
                expect(res.body.total).to.be.above(0);
                expect(res.body.countries).to.not.be(undefined);
                var country = res.body.countries[0];
                if (country) {
                    expect(country.name).to.not.be(undefined);
                    expect(country.id).to.be.above(0);
                } else {
                    expect().fail("No country data present.");
                }
                done()
            })
        });
        
        it('GET by ID with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/2')
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(200);
                expect(res.body).to.not.eql(null);
                expect(res.body.name).to.be.eql("Canada");
                expect(res.body.id).to.be.eql(2);
                done();
            })
        });
        
        it('GET collection with Name query with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/countries?$filter=(name eq \'Canada\')')
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(200);
                expect(res.body.total).to.be.eql(1);
                expect(res.body.countries).to.not.be(undefined);
                var country = res.body.countries[0];
                expect(country.name).to.be.eql("Canada");
                expect(country.id).to.be.eql(2);
                done();
            })
        });
        
        it('GET by invalid ID with 404 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/' + RANDOM_ID)
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('POST valid creation with 201 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ name: 'German States - Bavaria', description: 'State of Germany' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var body = res.body;
                expect(body.id).to.not.eql(null);
                expect(body.id).to.be.above(1000);
                expect(body.name).to.eql("German States - Bavaria");
                expect(body.description).to.eql("State of Germany");
                done();
            })
        });
        
        it('POST duplicate creation with 409 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ name: 'German States - Prussia' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var body = res.body;
                delete body.id;
                superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send(body).end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(409);
                    done();
                });
                
            })
        });
        
        it('POST missing name field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ description: 'some description' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(400);
                done();
            })
        });
        
        it('PUT successfully with 200 status', function (done) {
            var name = 'POST success';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ name: name })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var id = res.body.id;
                superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                .send({ name: 'PUT update', description: 'Description on update' })
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(200);
                    expect(res.body.name).to.eql('PUT update');
                    expect(res.body.description).to.eql('Description on update');
                    done();
                });
            });
        });
        
        it('PUT with invalid non-existing ID', function (done) {
            superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + RANDOM_ID)
            .send({ description: 'some description' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('PUT causing a conflict', function (done) {
            var conflict_name = 'PUT with conflict (orignial)';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ name: conflict_name })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
                .send({ name: 'PUT causing conflict' })
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    // Now verify it is not found.
                    superagent.put('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                        .send({ name: conflict_name })
                        .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(409);
                        done();
                    });
                });
            });
        });
        
        it('DELETE no existing ID', function (done) {
            superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + RANDOM_ID)
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('DELETE successful with no retained state', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/countries')
            .send({ name: 'TEST DELETE' })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var id = res.body.id;
                superagent.del('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(204);
                    // Now verify it is not found.
                    superagent.get('http://' + hostname + ':' + server_port + '/rest/countries/' + id)
                        .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(404);
                        done();
                    });
                });
            });
        });
    });
    
    describe('Album REST API tests', function (done) {
        
        it('GET Collection with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/albums')
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(200);
                expect(res.body.total).to.be.above(0);
                expect(res.body.albums).to.not.be(undefined);
                var album = res.body.albums[0];
                if (album) {
                    expect(album.name).to.not.be(undefined);
                    expect(album.id).to.be.above(0);
                } else {
                    expect().fail("No album data present.");
                }
                done()
            })
        });
        
        it('GET by ID with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/albums/1')
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(200);
                expect(res.body).to.not.eql(null);
                expect(res.body.name).to.be.eql("Australia");
                expect(res.body.id).to.be.eql(1);
                done();
            })
        });
        
        it('GET collection with Name query with 200 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/albums?$filter=(name eq \'Australian States\')')
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(200);
                expect(res.body.total).to.be.eql(1);
                expect(res.body.albums).to.not.be(undefined);
                var album = res.body.albums[0];
                expect(album.name).to.be.eql("Australian States");
                expect(album.id).to.be.eql(2);
                done();
            })
        });
        
        it('GET by invalid ID with 404 status', function (done) {
            superagent.get('http://' + hostname + ':' + server_port + '/rest/albums/' + RANDOM_ID)
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('POST valid creation with 201 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: 'British Europe', stampCollectionRef: 1, description: 'European countries' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var body = res.body;
                expect(body.id).to.not.eql(null);
                expect(body.name).to.eql("British Europe");
                expect(body.description).to.eql("European countries");
                done();
            })
        });
        
        it('POST duplicate creation with 409 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: 'German States', stampCollectionRef: 1 })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var body = res.body;
                delete body.id;
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send(body).end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(409);
                    done();
                });
                
            })
        });
        
        it('POST missing name field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ description: 'some description' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(400);
                done();
            })
        });
        
        it('POST missing stamp collection ref field with 400 status', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: 'Some album' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(400);
                done();
            })
        });
        
        it('PUT successfully with 200 status', function (done) {
            var name = 'POST album';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: name, stampCollectionRef: 1, countries: [1] })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var id = res.body.id;
                superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                .send({ name: 'PUT album', description: 'Description on update', countries: [2] })
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(200);
                    expect(res.body.name).to.eql('PUT album');
                    expect(res.body.description).to.eql('Description on update');
                    done();
                });
            });
        });
        
        it('PUT with invalid non-existing ID', function (done) {
            superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + RANDOM_ID)
            .send({ description: 'some description' })
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('PUT causing a conflict', function (done) {
            var conflict_name = 'PUT with conflict (orignial)';
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: conflict_name, stampCollectionRef: 1 })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                .send({ name: 'PUT causing conflict', stampCollectionRef: 1 })
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(201);
                    var id = res.body.id;
                    // Now verify it is not found.
                    superagent.put('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                        .send({ name: conflict_name })
                        .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(409);
                        done();
                    });
                });
            });
        });
        
        it('DELETE no existing ID', function (done) {
            superagent.del('http://' + hostname + ':' + server_port + '/rest/albums/' + RANDOM_ID)
          .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(404);
                done();
            })
        });
        
        it('DELETE successful with no retained state', function (done) {
            superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
            .send({ name: 'TEST DELETE', stampCollectionRef: 1 })
            .end(function (e, res) {
                expect(e).to.eql(null);
                expect(res.status).to.eql(201);
                var id = res.body.id;
                superagent.del('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                  .end(function (e, res) {
                    expect(e).to.eql(null);
                    expect(res.status).to.eql(204);
                    // Now verify it is not found.
                    superagent.get('http://' + hostname + ':' + server_port + '/rest/albums/' + id)
                        .end(function (e, res) {
                        expect(e).to.eql(null);
                        expect(res.status).to.eql(404);
                        done();
                    });
                });
            });
        });
    });
    
    describe('Stamp Collection REST API tests', function (done) {
        it('DELETE successful removes albums and countries', function (done) {
            var count = 0;
            var total = 10;
            var post = function (name, callback) {
                superagent.post('http://' + hostname + ':' + server_port + '/rest/albums')
                    .send({ name: name, stampCollectionRef: 1 })
                  .end(function (e, res) {
                    callback();
                });
            };
            var postCallback = function () {
                count++;
                if (count !== total) {
                    post("Album-" + count, postCallback);
                }
            }
            post("Album-" + count, postCallback);
            var theInterval;
            var f = function () {
                if (count === total) {
                    console.log("all are finished");
                    clearInterval(theInterval);
                    superagent.del('http://' + hostname + ':' + server_port + '/rest/stampCollections/1')
                        .end(function (e, res) {
                            expect(e).to.eql(null);
                            expect(res.status).to.eql(204);
                            done();
                    });
                }
            }
            theInterval = setInterval(f, 50);
            
        });
        
        it.skip('DELETE successful removes all associated stamps', function (done) {
        });

    });

});