// Load sql.js WebAssembly file
let config = {
    locateFile: () => "/garmin/sql-wasm.wasm",
};



var db = null;

//Requires that an element with the id=garmin is present in the DOM.
function startGarminWizard()
{
    initSqlJs(config).then(function (SQL) {
        console.log("sql.js initialized 🎉");
        fetch('/garmin/products.db?v=3')
        .then(response => response.arrayBuffer())
        .then(buffer => {
            // Create a new database
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

    // Generate HTML elements for product specs
    // An element with the id "garmin" must be present in the DOM.
    var container = document.getElementById("garmin");
    //container.classList.add('container');

    // Group product specs by SpecGroupKeyDisplayName
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

    CreateButtonsToExpandAndCollapseAllTables();

    // Iterate over the grouped specs and create HTML elements
    let previousSpeckey = null; // Variable to track the previous speckey
    let colorIndex = 0; // Index for alternating background colors

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
            var row = document.createElement('tr');
            var cell1 = document.createElement('td');

            var cell3 = document.createElement('td');

            var cell4 = document.createElement('td');

            var cell4ResultTitle = document.createElement('div');
            var specDisplayValue = document.createElement('div');
            specDisplayValue.innerHTML = spec.specdisplayvalue; 
            cell4ResultTitle.appendChild(specDisplayValue);
            cell4ResultTitle.classList.add('garmintitle-without-content');

            var cell4Result = document.createElement('div');
            cell4Result.classList.add('content');
            cell4Result.classList.add('garmincollapsed');

            cell4.appendChild(cell4ResultTitle);
            cell4.appendChild(cell4Result);

            cell4ResultTitle.addEventListener('click', function () {
                const content = this.nextElementSibling;
                content.classList.toggle('garminexpanded');
                content.classList.toggle('garmincollapsed');
                // Toggle class for rotating the arrow
                this.classList.toggle('garmin-expanded-arrow');
            });

            var checkbox = document.createElement('input');
            checkbox.classList.add("garmin-checkbox");
            checkbox.type = 'checkbox';
            checkbox.value = spec.speckey;
            checkbox.setAttribute('data-group', groupName); // Assigning the data-group attribute
            checkbox.setAttribute('data-value', spec.specvalue);
            checkbox.addEventListener('change', function() {
                updateBadgeCount(groupName); // Update badge count when checkbox state changes

                if (checkbox.checked) {
                    cell4ResultTitle.classList.remove('garmintitle-without-content');
                    cell4ResultTitle.classList.add('garmintitle-with-content');
                    PopulateCellWithProducts(cell4Result, spec.speckey, spec.specvalue);
                } else {
                    cell4ResultTitle.classList.add('garmintitle-without-content');
                    cell4ResultTitle.classList.remove('garmintitle-with-content');
                    ClearCell(cell4Result, spec.speckey);
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
    });
}

function CreateButtonsToExpandAndCollapseAllTables()
{
    var expandButton = document.createElement('button');
    expandButton.classList.add("button");
    expandButton.classList.add("button--info");
    expandButton.textContent = 'Expand All';
    expandButton.addEventListener('click', expandAll);

    var collapseButton = document.createElement('button');
    collapseButton.classList.add("button");
    collapseButton.classList.add("button--info");
    collapseButton.textContent = 'Collapse All';
    collapseButton.addEventListener('click', collapseAll);

    // Append buttons to the container

    var space = document.createElement("span");
    space.style.marginRight = "10px"; // Adjust the margin as needed for your layout

    var expandAllButton = document.getElementById('expand-all-button');
    expandAllButton.appendChild(expandButton);
    var collapseAllButton = document.getElementById('collapse-all-button');
    collapseAllButton.appendChild(collapseButton);
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
    var numberOfProducts = result[0].values[0];
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
    var query = `SELECT displayName, productUrl FROM products where specKey="${speckey}" and specValue="${specvalue}";`;
    console.log(query);
    var result = db.exec(query);
    result[0].values.forEach(row => {
        element.innerHTML += `<a target="_blank" href="${row[1]}">${row[0]}</a> `;
    });
}

function PopulateMatchingProductResults() 
{
    // Create a result container to display matching products
    var resultContainer = document.getElementById('garmin-result');
    resultContainer.innerHTML = '';

    // Get the checked speckeys
    const checkedSpecs = {};
    var selectedCheckBoxes = document.querySelectorAll('input[type="checkbox"]:checked');

    if(selectedCheckBoxes.length == 0) {
        return;
    }

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

    // Generate the query
    let query = '';
    let numberOfUniqueSpecs = 0
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

    // Execute the query
    const sqlQuery = `
        SELECT productId, displayName, productUrl
        FROM products
        WHERE ${query}
        GROUP BY displayName
        HAVING COUNT(specKey) = ${numberOfUniqueSpecs};
    `;

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
            resultText.innerHTML += `<a target="_blank" href="${row[2]}">${row[1]}</a><br/>`;
        });
    
        resultContainer.appendChild(resultText);
    }
}

function ClearCell(element, speckey) {
    element.innerHTML = "";
}

