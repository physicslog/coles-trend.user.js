// ==UserScript==
// @name       Coles Trend
// @version     1.0
// @description A simple extension that adds historical price trends to coles.com.au
// @author      Originally by Data Holdings Group & Userscript made by Damodar Rajbhandari
// @match       *://*.coles.com.au/*
// @require     https://unpkg.com/chart.js@4.4.6/dist/chart.umd.js
// @require     https://unpkg.com/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.js
// @run-at document-start
// @grant       GM_xmlhttpRequest
// @connect     https://data-holdings-fastapi-lp22d.ondigitalocean.app
// @downloadURL https://github.com/physicslog/coles-trend.user.js/raw/refs/heads/main/coles-trend.user.js
// @updateURL   https://github.com/physicslog/coles-trend.user.js/raw/refs/heads/main/coles-trend.user.js
// ==/UserScript==

/* file: dhg-styles.css*/
var styles = `
/* Card template */
.dhg-card {
    border-bottom: 2px solid #ffa500;
    overflow: hidden;
    margin-bottom: 20px;
}
.dhg-card-header {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    background-color: #ffffff;
    border-bottom: 2px solid #ffa500;
}
.dhg-title {
    font-size: 16px;
    font-weight: bold;
}
.dhg-card-content {
    padding: 10px;
}
.dhg-disclaimer {
    font-size: .8rem;
}
.spaced-item {
    margin-right: 1rem;
}
/* Chart html */
#priceHistoryChart {
    margin-top: 1rem;
    margin-bottom: 1rem;
}
`

var styleSheet = document.createElement("style")
styleSheet.textContent = styles
document.head.appendChild(styleSheet)

/* file: content.js */
// Function that checks for URL changes and if so, runs the main funciton
async function handleUrlChange() {
    const currentUrl = window.location.href;
    let urlParts = currentUrl.split('-');
    let productId = urlParts[urlParts.length - 1];
    if (productId.includes('?')) {
        urlParts = productId.split('?'); // Correct split character
        productId = urlParts[0]; // Get the part before '?'
    }
    let parsedProductId = Number(productId);
    // Check if parsedProductId is a number and an integer
    if (!isNaN(parsedProductId) && Number.isInteger(parsedProductId)) {
        await main(parsedProductId);
        ParsePostPayloadToAPI();
    }
}
window.addEventListener('load', handleUrlChange);
// Observer url changes
const observer = new MutationObserver(() => {
    if (window.location.href !== observer.currentUrl) {
        observer.currentUrl = window.location.href;
        handleUrlChange();
    }
});
// Initialize currentUrl with the current window location
observer.currentUrl = window.location.href;
// Start observing the document body for mutations
observer.observe(document.body, {
    subtree: true,
    childList: true
});

/* file: lib/dhg.js */
// Get the data -> JSON
async function fetchProductData(product_id) {
    const url = `https://data-holdings-fastapi-lp22d.ondigitalocean.app/coles/product_search/${product_id}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data.priceHistory)) {
            throw new Error('The response data is not an array');
        }
        return data;
    } catch (error) {
        return {
            "priceHistory": []
        };
    }
}
// ParseSmallProductPayload
async function ParsePostPayloadToAPI() {
    const scriptTag = document.querySelector('script[type="application/ld+json"]');
    // Check if the script tag exists
    if (scriptTag) {
        // Get the content of the script tag
        const jsonData = scriptTag.textContent;
        // Parse the JSON content
        const payload = JSON.parse(jsonData);
        // Add a created date
        payload.createdDate = new Date()
            .toISOString();
        // Attach storeID to gather correct price for specific store
        const storeID = localStorage.getItem('shoppingMethod');
        if (storeID) {
            const storeIdPayload = JSON.parse(storeID);
            payload.storeID = storeIdPayload;
        }
        const url = "https://data-holdings-fastapi-lp22d.ondigitalocean.app/coles/coles_product_payload";
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache"
                },
                body: JSON.stringify({
                    data: payload
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const result = await response.json();
            return result;
        } catch (error) {
            throw error;
        }
    }
}
// Add days key to show number of days between last price change
function addDaysToPriceHistory(priceHistory) {
    // Function to calculate the number of days between two dates
    function calculateDaysBetween(date1, date2) {
        const msInDay = 24 * 60 * 60 * 1000; // Number of milliseconds in a day
        return Math.round((date2 - date1) / msInDay);
    }
    // Iterate over the array to add 'days' key
    for (let i = 0; i < priceHistory.length; i++) {
        const currentDate = new Date(priceHistory[i].date);
        let nextDate;
        if (i < priceHistory.length - 1) {
            // Use the next date in the array
            nextDate = new Date(priceHistory[i + 1].date);
        } else {
            // Use the current UTC date for the last entry
            nextDate = new Date();
        }
        // Calculate the number of days between the current date and the next date
        priceHistory[i].days = calculateDaysBetween(currentDate, nextDate);
    }
    return priceHistory;
}
// Filter data -> JSON
function filterHistory(priceHistory) {
    // If the priceHistory array is empty, return it immediately
    return priceHistory.slice(-10)
}
function insightsArray(priceHistory) {
    let minPrice = Math.min(...priceHistory.map(item => item.price));
    let maxPrice = Math.max(...priceHistory.map(item => item.price));
    let priceChanges = priceHistory.length;
    let uniquePrices = new Set(priceHistory.map(item => item.price))
        .size;
    let insightsArray = [];
    if (uniquePrices > 1) {
        insightsArray = [
            `⬇️ Low $${minPrice.toFixed(2)}`,
            `⬆️ High $${maxPrice.toFixed(2)}`,
            `➡️ ${priceChanges - 1} Price changes`,
            `➡️ ${uniquePrices} Different prices`
        ];
    }
    if (uniquePrices == 1) {
        insightsArray = [
            `⬇️ Low $${minPrice.toFixed(2)}`,
            `⬆️ High $${maxPrice.toFixed(2)}`,
            `➡️ ${priceChanges - 1} Price changes`,
        ];
    }
    let insightsHTML = insightsArray.map(item => `<span class="spaced-item">${item}</span>`)
        .join('');
    return insightsHTML
}
// Create html with insights -> HTML
function createDisclaimerHTML(minStatement) {
    return `
        <span style="display: block; font-size: 1rem; font-weight: bold;">
            ${minStatement.statement}
        </span>
    `;
}
// Create html canvas for chart object -> ?
function createLineChartHTML() {
    return `
        <canvas id="priceHistoryChart" width="400" height="200"></canvas>
    `;
}

function renderLineChart(priceHistory) {
    const ctx = document.getElementById('priceHistoryChart')
        .getContext('2d');
    const labels = priceHistory.map(entry => new Date(entry.date)
        .toLocaleDateString());
    const data = priceHistory.map(entry => entry.price.toFixed(2));
    // Registering the above chart to add labels via the plugin in lib
    Chart.register(ChartDataLabels);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price',
                data: data,
                fill: false,
                backgroundColor: 'rgba(255, 165, 0, .95)', 
                borderColor: 'rgba(255, 165, 0, 1)', 
                borderWidth: 1, // Optional: set the border width
                tension: .4
            }]
        },
        options: {
            layout: {
                padding: {
                    top: 20
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: false,
                        text: 'Date'
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: false,
                        text: 'Price ($)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    // Use the 'labels' option to define multiple datalabels configurations
                    labels: {
                        // Price labels at the end of each bar
                        price: {
                            anchor: 'end',
                            align: 'end',
                            offset: 0,
                            formatter: function(value, context) {
                                return '$' + value; // Format the data label as price
                            },
                            color: 'black', // Color of the data label
                            font: {
                                size: 12
                            }
                        },
                        // Days labels at the center of each bar
                        days: {
                            anchor: 'start',
                            align: 'start', 
                            offset: -40,
                            formatter: function(value, context) {
                                const index = context.dataIndex; 
                                const days = priceHistory[index].days; 
                                return [days, 'Days'];
                            },
                            color: '#4D4D4D',
                            font: {
                                size: 12,
                            },
                            textAlign: 'center'
                        }
                    }
                }
            }
        }
    });
}
// Plop HTML on page & update any already plopped things like canvas etc. -> Page updates
function updateDOMWithPriceHistory(filteredHistory) {
    let productPriceElement = document.querySelector('[data-testid="product_price"]');
    if (!productPriceElement) {
        productPriceElement = document.querySelector('.product__title');
    }
    const html_template = `
        <div class="dhg-card">
            <div class="dhg-card-header">
                <span class="dhg-title">🔥 PRICE TREND ANALYSIS 🔥</span>
            </div>
            <div class="dhg-card-content">
                <canvas id="priceHistoryChart" width="400" height="200"></canvas>
                <span class="dhg-disclaimer">Price trends are based on data from the Coles online website without a specific location selected,
                                            reflecting movements over last 10 price changes. Actual prices may vary by store, especially for fresh food 
                                            and other perishable items.
                </span>
            </div>
        </div>
        `;
    let existingElement = document.querySelector('.dhg-card');
    if (existingElement) {
        // Remove the existing element
        existingElement.remove();
    }
    productPriceElement.insertAdjacentHTML('afterend', html_template);
    const dhgCard = document.querySelector('[class="dhg-card-content"]');
    if (productPriceElement) {
        renderLineChart(filteredHistory);
        dhgCard.insertAdjacentHTML('afterbegin', insightsArray(filteredHistory));
    }
}
// Main functions that strings all the above functions together
async function main(productId) {
    let productData = await fetchProductData(productId);
    if (productData.priceHistory.length > 0) {
        let productDataDays = addDaysToPriceHistory(productData.priceHistory);
        let filteredHistory = filterHistory(productDataDays, 100);
        updateDOMWithPriceHistory(filteredHistory);
    }
}
