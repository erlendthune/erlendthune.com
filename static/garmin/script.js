//Requires that an element with the id=garmin is present in the DOM.

// Load sql.js WebAssembly file
let config = {
    locateFile: () => "/garmin/sql-wasm.wasm",
};

var db = null;
var invertSpecificationRequirements = false;
var numberOfProducts = 0;

function startGarminWizard()
{
    tabSupport();

    initSqlJs(config).then(function (SQL) {
        console.log("sql.js initialized 🎉");
        fetch('/garmin/products.db?v=4')
        .then(response => response.arrayBuffer())
        .then(buffer => {
            db = new SQL.Database(new Uint8Array(buffer));
            addGarminWizard();
        })
        .catch(error => console.error('Error loading database:', error));
    });
}
function addGarminWizard() {
    populateNumberOfUniqueProducts();
    populateNumberOfUniqeSpecifications();

    // Execute a query to retrieve distinct product specs
    var result = db.exec("SELECT specGroupKeyDisplayName, specKey, specValue, specDisplayName, specDisplayValue FROM products GROUP BY specGroupKeyDisplayName, specKey, specValue ORDER BY specGroupKeyDisplayName, specKey");

    groupedSpecs = groupProductSpecsBySpecGroupKeyDisplayName(result);

    createCheckboxToExpandAndCollapseAllTables();
    //createCheckboxToInvertSpecificationRequirements();

    iterateOverTheGroupedSpecsAndCreateHTMLElements(groupedSpecs);
}

// Generate HTML elements for product specs
// An element with the id "garmin" must be present in the DOM.
function iterateOverTheGroupedSpecsAndCreateHTMLElements(groupedSpecs)
{
    var container = document.getElementById("garmin");

    let previousSpeckey = null; // Variable to track the previous speckey
    let colorIndex = 0; // Index for alternating background colors
    let rowId = 0;

    Object.entries(groupedSpecs).forEach(([groupName, specs]) => {
        var titleElement = document.createElement('h3');
        titleElement.textContent = groupName;
        titleElement.classList.add("garmintitle");
    
        var badge = document.createElement('span');
        badge.style.display = 'none'; // Hide the badge
        badge.classList.add('garminbadge');
        badge.textContent = '0';
        badge.setAttribute('data-group', groupName); // Assigning the data-group attribute
    
        titleElement.appendChild(badge);
        
        titleElement.addEventListener('click', function () {
            const content = this.nextElementSibling;
            content.classList.toggle('garminexpanded');
            content.classList.toggle('garmincollapsed');
            // Toggle class for rotating the arrow
            this.classList.toggle('garmin-expanded-arrow');
        });
    
        container.appendChild(titleElement);
    
        // Add div to wrap content
        var contentWrapper = document.createElement('div');
        contentWrapper.classList.add('garmincollapsed');
        contentWrapper.classList.add('content');
        container.appendChild(contentWrapper);
    
        var table = document.createElement('table');
        var tbody = document.createElement('tbody');
        specs.forEach(spec => {
            rowId++;
            var row = document.createElement('tr');
            var cell1 = document.createElement('td');
    
            var cell3 = document.createElement('td');
    
            var cell4 = document.createElement('td');
            var specDisplayValue = document.createElement('div');
            specDisplayValue.innerHTML = spec.specdisplayvalue; 
            cell4.appendChild(specDisplayValue);
    
            var cell4ResultTitle = document.createElement('div');
            cell4ResultTitle.innerHTML = "<span>Products with specification</span>";
            cell4ResultTitle.classList.add('garmintitle-without-content');
    
            var cell4Result = document.createElement('div');
            cell4Result.setAttribute("id", "row" + rowId + "resultCell");
            cell4Result.classList.add('garmincollapsed');

            var cell4InvertedResultTitle = document.createElement('div');
            cell4InvertedResultTitle.innerHTML = "<span>Products without specification</span>";
            cell4InvertedResultTitle.classList.add('garmintitle-without-content');

            var cell4InvertedResult = document.createElement('div');
            cell4InvertedResult.setAttribute("id", "row" + rowId + "invertedResultCell");
            cell4InvertedResult.classList.add('garmincollapsed');

            cell4.appendChild(cell4ResultTitle);
            cell4.appendChild(cell4Result);
            cell4.appendChild(cell4InvertedResultTitle);
            cell4.appendChild(cell4InvertedResult);
    
            cell4ResultTitle.addEventListener('click', function () {
                const content = this.nextElementSibling;
                content.classList.toggle('garminexpanded');
                content.classList.toggle('garmincollapsed');
                // Toggle class for rotating the arrow
                this.classList.toggle('garmin-expanded-arrow');
            });

            cell4InvertedResultTitle.addEventListener('click', function () {
                const content = this.nextElementSibling;
                content.classList.toggle('garminexpanded');
                content.classList.toggle('garmincollapsed');
                // Toggle class for rotating the arrow
                this.classList.toggle('garmin-expanded-arrow');
            });

            var checkbox = CreateCheckbox(spec.speckey, spec.specvalue, groupName);
            checkbox.addEventListener('change', function() {
                updateBadgeCount(groupName); // Update badge count when checkbox state changes
        
                if (checkbox.checked) {
                    cell4ResultTitle.classList.remove('garmintitle-without-content');
                    cell4ResultTitle.classList.add('garmintitle-with-content');
                    cell4InvertedResultTitle.classList.remove('garmintitle-without-content');
                    cell4InvertedResultTitle.classList.add('garmintitle-with-content');
                    PopulateCellWithProducts(cell4Result, spec.speckey, spec.specvalue);
                    PopulateCellWithInvertedProducts(cell4InvertedResult, spec.speckey, spec.specvalue);
                } else {
                    cell4ResultTitle.classList.add('garmintitle-without-content');
                    cell4ResultTitle.classList.remove('garmintitle-with-content');
                    ClearCell(cell4Result);
                    ClearCell(cell4InvertedResult);
                }
                PopulateMatchingProductResults();
            });
        
        
            cell1.appendChild(checkbox);
            cell3.innerHTML = spec.specdisplayname;
            row.appendChild(cell1);
            
            // Uncomment to get specKey in separate column
            // row.appendChild(cell2);
            row.appendChild(cell3);
            row.appendChild(cell4);
    
            // Apply alternating background color based on speckey
            if (previousSpeckey !== spec.speckey) {
                colorIndex = 1 - colorIndex; // Toggle color index
            }
            row.style.backgroundColor = colorIndex === 0 ? '#aaf0aa' : '#00e000'; // Apply color
            previousSpeckey = spec.speckey; // Update previous speckey
    
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        contentWrapper.appendChild(table);
        contentWrapper.appendChild(document.createElement('br')); // Add line break between tables

        PopulateMatchingProductResults();
    });
}

function groupProductSpecsBySpecGroupKeyDisplayName(result) {

    var groupedSpecs = {};
    result[0].values.forEach(row => {
        var spec = {
            SpecGroupKeyDisplayName: row[0],
            speckey: row[1],
            specvalue: row[2],
            specdisplayname: row[3],
            specdisplayvalue: row[4]
        };
        if (!groupedSpecs[spec.SpecGroupKeyDisplayName]) {
            groupedSpecs[spec.SpecGroupKeyDisplayName] = [];
        }
        groupedSpecs[spec.SpecGroupKeyDisplayName].push(spec);
    });
    return groupedSpecs;
}

function CreateCheckbox(key, value, groupName) {
    var checkbox = document.createElement('input');
    checkbox.classList.add("garmin-checkbox");
    checkbox.classList.add("garmin-specification-checkbox");
    checkbox.type = 'checkbox';
    checkbox.value = key;
    checkbox.setAttribute('data-group', groupName); // Assigning the data-group attribute
    checkbox.setAttribute('data-value', value);
    return checkbox;     
}

function createCheckboxToExpandAndCollapseAllTables()
{
    var checkbox = document.createElement('input');
    checkbox.classList.add("garmin-checkbox");
    checkbox.type = 'checkbox';
    checkbox.addEventListener('click',function() {
        if (checkbox.checked) {
            expandAll();
        } else {
            collapseAll();
        }
    });

    var expandAllButton = document.getElementById('expand-all-button');
    expandAllButton.appendChild(checkbox);
}

function createCheckboxToInvertSpecificationRequirements()
{
    var checkbox = document.createElement('input');
    checkbox.classList.add("garmin-checkbox");
    checkbox.type = 'checkbox';
    checkbox.addEventListener('click',function() {
        if (checkbox.checked) {
            invertSpecificationRequirements = true;
        } else {
            invertSpecificationRequirements = false;
        }
        updateAllResults();
    });

    var invertCheckboxElement = document.getElementById('invert-checkbox');
    invertCheckboxElement.appendChild(checkbox);
}


// Function to expand all tables
function expandAll() {
    document.querySelectorAll('.content').forEach(content => {
        content.classList.remove('garmincollapsed');
        content.classList.add('garminexpanded');
    });
}

// Function to collapse all tables
function collapseAll() {
    document.querySelectorAll('.content').forEach(content => {
        content.classList.remove('garminexpanded');
        content.classList.add('garmincollapsed');
    });
}
// Function to update badge count
function updateBadgeCount(groupName) {
    const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-group="${groupName}"]`);
    const badge = document.querySelector(`.garminbadge[data-group="${groupName}"]`);

    let selectedCount = 0;
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedCount++;
        }
    });

    if (selectedCount > 0) {
        badge.textContent = selectedCount;
        badge.style.display = 'inline-block'; // Show the badge
    } else {
        badge.style.display = 'none'; // Hide the badge
    }    
}

function populateNumberOfUniqueProducts()
{
    var result = db.exec("SELECT COUNT(DISTINCT productId) AS NumberOfProducts FROM products;");
    numberOfProducts = result[0].values[0];
    console.log(`Number of products:${numberOfProducts}`);
    var div = document.getElementById("productCountPlaceholder");
    div.innerHTML += numberOfProducts;

}
function populateNumberOfUniqeSpecifications()
{
    var result = db.exec("SELECT COUNT(DISTINCT specKey) AS NumberOfSpecifications FROM products;");
    var numberOfSpecifications = result[0].values[0];
    console.log(`Number of products:${numberOfSpecifications}`);
    var div = document.getElementById("specificationCountPlaceholder");
    div.innerHTML += numberOfSpecifications;
}

function PopulateCellWithProducts(element, speckey, specvalue) {
    var finalQuery = `SELECT productId, displayName, productUrl, price FROM products where specKey="${speckey}" and specValue="${specvalue}" order by price asc`;

    console.log(finalQuery);
    var result = db.exec(finalQuery);

    result[0].values.forEach(row => {
        var price = getFormattedPrice(row[3]);
        element.innerHTML += `<a target="_blank" href="${row[2]}">${row[1]}</a> ${price}<br/>`;
    });
}

function getFormattedPrice(unformattedPrice)
{
    var price = unformattedPrice;
    if(price == null)
    {
        price = "-";
    }
    else
    {
        price = "$" + price + " USD";
    }
    return price;
}
function PopulateCellWithInvertedProducts(element, speckey, specvalue) {
    var finalQuery = getBeginInversion();

    finalQuery += `SELECT productId, displayName, productUrl FROM products where specKey="${speckey}" and specValue="${specvalue}"`;

    finalQuery += getEndInversion();

    console.log(finalQuery);
    var result = db.exec(finalQuery);

    result[0].values.forEach(row => {
        element.innerHTML += `<a target="_blank" href="${row[2]}">${row[1]}</a><br/>`;
    });
}

function updateMatchingProductsBadge(noOfProducts)
{
    var badge = document.getElementById("matchingProducts");
    badge.classList.remove("garminbadgehidden");
    badge.classList.add("garminbadge");
    badge.textContent = noOfProducts;
}

function PopulateMatchingProductResults() 
{
    // Create a result container to display matching products
    var resultContainer = document.getElementById('garmin-result');
    resultContainer.innerHTML = '';

    // Get the checked speckeys
    const checkedSpecs = {};
    var selectedCheckBoxes = getAllCheckSpecificationCheckBoxes();

    var sqlQuery = "";
    if(selectedCheckBoxes.length == 0) 
    {
        sqlQuery = `SELECT productId, displayName, productUrl, price
        FROM products
        GROUP BY productId
        ORDER BY price`;
    } 
    else 
    {
        selectedCheckBoxes.forEach(checkbox => {
            const group = checkbox.getAttribute('data-group');
            if (!checkedSpecs[group]) {
                checkedSpecs[group] = {};
            }
    
            const speckey = checkbox.value;
            if (!checkedSpecs[group][speckey]) {
                checkedSpecs[group][speckey] = [];
            }
            checkedSpecs[group][speckey].push(checkbox.getAttribute('data-value'));
        });
    
        sqlQuery = generateTheQueryAcrossAllSpecificationGroups(checkedSpecs);
    }

    // Use sqlQuery in the fetch call to get the desired results
    console.log(sqlQuery);
    var matchingProducts = db.exec(sqlQuery);
    
    // Clear previous results
    resultContainer.innerHTML = '';
    if(matchingProducts.length == 0)
    {
        resultContainer.innerHTML = 'Could not find any matching products';
    }
    else
    {
        var resultText = document.createElement('p');
        matchingProducts[0].values.forEach(row => {
            var price = getFormattedPrice(row[3]);
            resultText.innerHTML += `<a target="_blank" href="${row[2]}">${row[1]}</a> ${price}<br/>`;
        });
    
        resultContainer.appendChild(resultText);
        updateMatchingProductsBadge(matchingProducts[0].values.length);
    }
}

function getAllCheckSpecificationCheckBoxes() 
{
    return document.querySelectorAll('input[type="checkbox"].garmin-specification-checkbox:checked');    
}

function generateTheQueryAcrossAllSpecificationGroups(checkedSpecs) 
{
    let finalQuery = '';

    if(invertSpecificationRequirements)
    {
        finalQuery = getBeginInversion();
    }

    let numberOfUniqueSpecs = 0
    var query = '';
    Object.values(checkedSpecs).forEach((spec, groupIndex) => {
        if (groupIndex > 0) {
            query += ' OR ';
        }

        query += '(';
        Object.entries(spec).forEach(([speckey, values], specIndex) => 
        {
            numberOfUniqueSpecs++;
            if(specIndex > 0) {
                query += ' OR ';
            }
            values.forEach((value, index) => 
            {
                if (index > 0) {
                    query += ' OR ';
                }
                query += `(specKey = '${speckey}' AND specValue = '${value}')`;
            });
        });
        query += ')';
    });

    finalQuery += `
    SELECT productId, displayName, productUrl, price
    FROM products
    WHERE ${query}
    GROUP BY displayName
    HAVING COUNT(specKey) = ${numberOfUniqueSpecs}
    ORDER BY price
    `;

    if(invertSpecificationRequirements)
    {
        finalQuery += getEndInversion();
    }
    return finalQuery;    
}

function getBeginInversion()
{
    return `SELECT p.productId, p.displayName, p.productUrl
    FROM products p
    LEFT JOIN (`;    
}

function getEndInversion()
{
    return `) hasSpecifications ON p.productId = hasSpecifications.productId
    WHERE hasSpecifications.productId is null
    GROUP BY p.displayName;`    
}

function ClearCell(element) {
    element.innerHTML = "";
}


function tabSupport()
{
    // Get all tab buttons and tab contents
    var tabButtons = document.querySelectorAll('.tablinks');
    var tabContents = document.querySelectorAll('.tabcontent');

    // Add click event listener to each tab button
    tabButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            var pageName = this.getAttribute('data-page');

            // Hide all tab contents
            tabContents.forEach(function(content) {
                content.style.display = 'none';
            });

            // Remove 'active' class from all tab buttons
            tabButtons.forEach(function(btn) {
                btn.classList.remove('active');
            });

            // Display the clicked tab content and mark the button as active
            document.getElementById(pageName).style.display = 'block';
            this.classList.add('active');
        });
    });

    var tab1 = document.getElementById('defaultOpen');
    tab1.click();
}
