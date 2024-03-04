---
title: Garmin watch wizard
sidebar_position: 3
---
<div>
    At the time of downloading, Garmin had a total of 
    <span id="productCountPlaceholder"></span> watches on their web pages.

    These watches had a total of <span id="specificationCountPlaceholder"></span> specifications to choose
    between.
</div>

<div className="tab">
  <button className="tablinks" data-page="Page1" id="defaultOpen">
  <h2 id="requirements-title">Requirements</h2>
  </button>
  <button className="tablinks" data-page="Page2"><h2>Matching products<span id="matchingProducts" className="garminbadgehidden"></span></h2></button>
</div>

<div id="Page1" className="tabcontent">
    <span id="expand-all-button"> Expand all</span>
    <div id="garmin"></div>
</div>

<div id="Page2" className="tabcontent">
    <div id="garmin-result"></div>
</div>
