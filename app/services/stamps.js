var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var stamp = require('../model/stamp');
var ownership = require('../model/ownership');
var catalogueNumber = require('../model/catalogue-number');
var catalogue = require('../model/catalogue');
var country = require('../model/country');
var _ = require('lodash');
var q = require('q');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger("sql");

var stamps = extend(true, {}, new PersistentCollection(), function () {

    "use strict";

    function generateColumnExpression(fields, tableRef,distinct) {
        var s = "";
        _.each(fields, function (field, indx) {
            var c = tableRef + "." + field.column;
            if( distinct === true && field.column === 'ID' ) {
                c = "DISTINCT(" + c + ")";
            }
            s += c;
            if (indx < fields.length - 1) {
                s += ',';
            }
        });
        return s;
    }

    function populateKey(stamp, k) {
        if (!_.has(stamp, k)) {
            stamp[k] = [];
        }
    }

    function processRow(rows, row, fieldDef, key) {
        var s = _.findWhere(rows, { ID: row.STAMP_ID });
        if (!s) {
            sqlTrace.trace("No stamp found for " + row.STAMP_ID);
            return;
        }
        s[key].push(row);
    }

    function getFromTableForChildren (fieldDefinition) {
        var tables = stamp.getTableName() + ' AS ' + stamp.getAlias() + ' JOIN ' + fieldDefinition.getTableName() + ' AS ' + fieldDefinition.getAlias();
        tables += ' ON ' + stamp.getAlias() + '.ID=' + fieldDefinition.getAlias() + '.STAMP_ID';
        return tables;
    }

    function generateChildSelection(supportedFields, fieldDefinition, inValues) {
        var select = 'SELECT ' + generateColumnExpression(supportedFields, fieldDefinition.getAlias());
        select += ' FROM ' + getFromTableForChildren(fieldDefinition) + ' WHERE ' + fieldDefinition.getAlias() + '.STAMP_ID IN ' + inValues;
        return select;
    }

    return {
        preCommitUpdate: function (connection, merged, storedObj) {
            var defer = q.defer();
            var that = this;
            var updateList = [], createList = [];
            var parseChildren = function (childName, fieldDef) {
                if (merged[childName] && _.isArray(merged[childName])) {
                    _.each(merged[childName], function (obj) {
                        if (obj.ID) {
                            var current = _.findWhere(storedObj[childName], { ID: obj.ID});
                            var sql = dataTranslator.generateUpdateByFields(fieldDef, obj, current, true);
                            if (sql !== null) {
                                updateList.push(sql);
                            }
                        } else {
                            obj.STAMP_ID = merged.ID;
                            createList.push({ fieldDefinition: fieldDef, object: obj});
                        }
                    });
                }
            };
            parseChildren("CATALOGUENUMBER", catalogueNumber);
            parseChildren("OWNERSHIP", ownership);

            var total = updateList.length + createList.length;
            var count = 0;
            var resolveWhenFinished = function () {
                if (count === total) {
                    defer.resolve({
                        modified: total > 0
                    });
                }
            };
            resolveWhenFinished();
            _.each(updateList, function (sql) {
                sqlTrace.debug(sql);
                connection.query(sql, function (err, data) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        count++;
                        resolveWhenFinished();
                    }

                });
            });
            _.each(createList, function (obj) {
                var creating = obj;
                PersistentCollection.getNextSequence(creating.fieldDefinition, function (err, id) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        creating.object.ID = id;
                        var c_sql = dataTranslator.generateInsertByFields(creating.fieldDefinition, creating.object);
                        sqlTrace.debug(c_sql);
                        connection.query(c_sql, function (err, data) {
                            if (err !== null) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            } else {
                                count++;
                                resolveWhenFinished();
                            }
                        });
                        PersistentCollection.updateSequence(id, creating.fieldDefinition);
                    }
                });
            });
            return defer.promise;
        },

        postCreate: function (connection, obj) {
            var defer = q.defer();
            var total = ((obj.CATALOGUENUMBER) ? obj.CATALOGUENUMBER.length : 0) + ((obj.OWNERSHIP) ? obj.OWNERSHIP.length : 0);
            var created = 0;
            var that = this;
            if (obj.CATALOGUENUMBER && _.isArray(obj.CATALOGUENUMBER)) {
                _.each(obj.CATALOGUENUMBER, function (catNum) {
                    catNum.STAMP_ID = obj.ID;
                    that.generateId(catalogueNumber, catNum).then(function (id) {
                        catNum.ID = id;
                        var sql = dataTranslator. generateInsertByFields(catalogueNumber, catNum);
                        sqlTrace.debug(sql);
                        connection.query(sql, function (err, result) {
                            if (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            } else {
                                created++;
                                if (created === total) {
                                    defer.resolve(obj);
                                }
                            }
                        });
                    }, function (err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    });
                });
            }
            if (obj.OWNERSHIP && _.isArray(obj.OWNERSHIP)) {
                _.each(obj.OWNERSHIP, function (owner) {
                    owner.STAMP_ID = obj.ID;
                    that.generateId(ownership, owner).then(function (id) {
                        owner.ID = id;
                        var sql = dataTranslator. generateInsertByFields(ownership, owner);
                        sqlTrace.debug(sql);
                        connection.query(sql, function (err, result) {
                            if (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            } else {
                                created++;
                                if (created === total) {
                                    defer.resolve(obj);
                                }
                            }

                        });
                    });
                }, function (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                });
            }
            return defer.promise;
        },

        getFromTables: function (params) {
            var tables = stamp.getTableName() + ' AS ' + stamp.getAlias() + ' JOIN ' + catalogueNumber.getTableName() + ' AS ' + catalogueNumber.getAlias();
            tables += ' ON ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID ';
            tables += 'LEFT JOIN ' + ownership.getTableName() + ' AS ' + ownership.getAlias() + ' ON ' + stamp.getAlias() + '.ID = ' + ownership.getAlias() + '.STAMP_ID';
            if( params.$orderby ) {
                var orderby = params.$orderby;
                /*if( orderby.indexOf('number') > -1) {
                    tables += ' LEFT JOIN ' + catalogue.getTableName() + ' AS ' + catalogue.getAlias() + ' ON ' + catalogueNumber.getAlias() + '.CATALOGUE_REF=' + catalogue.getAlias() + '.ID';
                } else*/ if( orderby.indexOf('countryRef') > -1) {
                    tables += ' LEFT JOIN ' + country.getTableName() + ' AS ' + country.getAlias() + ' ON ' + stamp.getAlias() + '.COUNTRY_ID=' + country.getAlias() + '.ID';
                }
            }
            return tables;
        },

        getWhereClause: function (params) {
            var clause = (params && params.$filter) ? dataTranslator.toWhereClause(params.$filter, [stamp, catalogueNumber, ownership]) : '';
            if( clause.length > 0 ) {
                clause += ' AND ' + catalogueNumber.getAlias() + '.ACTIVE=1';
            }
            return clause;
        },

        find: function (params) {
            var defer = q.defer();
            var that = this;

            var rejectFn = function (field) {
                return (field.internal && field.internal === true && field.required !== true || field.model);
            };
            var stampDef = _.reject(stamp.getFieldDefinitions(), rejectFn);
            var catDef = _.reject(catalogueNumber.getFieldDefinitions(), rejectFn);
            var ownerDef = _.reject(ownership.getFieldDefinitions(), rejectFn);

            var select = 'SELECT SQL_CALC_FOUND_ROWS ' + generateColumnExpression(stampDef, stamp.getAlias(),true) + ' FROM ' + this.getFromTables(params);
            var whereClause = this.getWhereClause(params);
            var orderby = this.getOrderByClause(params, [stamp, ownership, catalogueNumber]);
            select += ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' ' + orderby + ' LIMIT ' + params.$offset + ',' + params.$limit;
            sqlTrace.debug(select);
            var t = (new Date()).getTime();
            connectionManager.getConnection().then(function (connection) {
                var query = connection.query(select, function (err, stamps) {
                    if (err) {
                        connection.release();
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        connection.query("SELECT FOUND_ROWS() AS ROWCOUNT", function (err, countData) {
                            if (err) {
                                connection.release();
                                defer.reject(dataTranslator.getErrorMessage(err));
                            } else {
                                var result = {
                                    rows: stamps,
                                    total: countData[0].ROWCOUNT
                                };
                                if (result.total === 0) {
                                    connection.release();
                                    defer.resolve(result);
                                } else {
                                    var ids = [];
                                    _.each(result.rows, function(row) {
                                        populateKey(row,'CATALOGUENUMBER');
                                        populateKey(row,'OWNERSHIP');
                                        ids.push(row.ID);
                                    });
                                    var inValues = dataTranslator.generateInValueStatement(ids);
                                    var queries = [
                                        {
                                            sql: generateChildSelection(catDef, catalogueNumber, inValues),
                                            fieldDefinition: catalogueNumber,
                                            collectionKey: 'CATALOGUENUMBER'
                                        },
                                        {
                                            sql: generateChildSelection(ownerDef, ownership, inValues),
                                            fieldDefinition: ownership,
                                            collectionKey: 'OWNERSHIP'
                                        }
                                    ];
                                    var completed = 0;
                                    var toExecute = queries.length;
                                    _.each(queries, function (query) {
                                        sqlTrace.debug(query.sql);
                                        var _query = connection.query(query.sql);
                                        _query.on('result', function (row) {
                                            processRow(result.rows, row, query.fieldDefinition, query.collectionKey);
                                        }).on('end', function () {
                                            completed++;
                                            if (completed === toExecute) {
                                                connection.release();
                                                sqlTrace.info("Time to query and process rows: " + (new Date().getTime() - t) + "ms");
                                                defer.resolve(result);
                                            }
                                        }).on('error', function (err) {
                                            connection.release();
                                            defer.reject(dataTranslator.getErrorMessage(err));
                                        });
                                    });
                                }
                            }
                        });
                    }
                });
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },
        collectionName: 'stamps',
        fieldDefinition: stamp
    };
}());

module.exports = stamps;
