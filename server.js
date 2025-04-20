// server.js
const express = require('express');
const app = express();
const PORT = 3000;

// middleware to parse json
app.use(express.json());

// Serve static frontend files
app.use(express.static('public'));

// Simple service endpoint
app.get('/api/hello', (req, res) => {
    res.send('Hello World');
});

// default api endpoint
const default_apiendpoint = "https://api.honeycomb.io";

// Sends query to Honeycomb - returns query ID when successful
app.post('/api/query', (req, res) => {
    // get the api key from the request header
    const apikey = req.headers['x-honeycomb-team'];
    // parse the json body with following fields
    const { datasetslug, query, apiendpoint } = req.body;
    console.log("datasetslug", datasetslug);
    console.log("query", query);
    // console.log("apikey", apikey);
    const endpoint = apiendpoint || default_apiendpoint;

    fetch(`${endpoint}/1/queries/${datasetslug}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-honeycomb-team': apikey
        },
        body: query
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        // return the query id as resopnse
        res.json(data);
    })
    .catch(error => {
        console.error('Error:', error);
        res.status(500).json({error: 'Error querying Honeycomb'});
    });
});

// helper function to poll for the query result to be complete and ready
async function pollQuery(endpoint, datasetslug, queryResultId, apikey) {
    console.log("polling query", datasetslug, queryResultId);
    return fetch(`${endpoint}/1/query_results/${datasetslug}/${queryResultId}`, {
        method: 'GET',
        headers: {
            'x-honeycomb-team': apikey
        }
    }).then(response => response.json())
    .then(data => {
        if(data.complete == true) {
            return data;
        } else {
            // wait 1 second and poll again
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(pollQuery(endpoint, datasetslug, queryResultId, apikey));
                }, 500);
            });
        }
    });
}

app.get('/api/query/:datasetslug/:id', (req, res) => {
    var datasetslug = req.params.datasetslug;
    var queryId = req.params.id;
    var series = req.query.series;
    var total = req.query.total;
    var other = req.query.other;
    var limit = req.query.limit;
    var apiendpoint = req.query.apiendpoint;

    if (limit == undefined) {
        limit = 1000;
    } else {
        limit = parseInt(limit);
    }
    if (series == undefined) {
        series = true;
    } else {
        series = series === "false";
    }
    if (total == undefined) {
        total = true;  
    } else {
        total = total === "false";
    }
    if (other == undefined) {
        other = true;
    } else {
        other = other === "false";
    }
    console.log("series", series);
    console.log("total", total);
    console.log("other", other);
    console.log("limit >> ", limit);

    var endpoint = apiendpoint || default_apiendpoint;
    console.log("endpoint", endpoint);

    var apikey = req.headers['x-honeycomb-team'];
    fetch(`${endpoint}/1/query_results/${datasetslug}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-honeycomb-team': apikey
        },
        body: JSON.stringify({
            query_id: queryId,
            disable_series: series,
            disable_total_by_aggregate: total,
            disable_other_by_aggregate: other,
            limit: limit
        })
    }).then(response => response.json())
    .then(data => {
        // get the query result id
        console.log("data", data);
        var queryResultId = data.id;
        console.log("queryResultId", queryResultId);
        // poll for the query result to be complete and ready
        pollQuery(endpoint, datasetslug, queryResultId, apikey).then(data => {
            res.json(data);
        });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
