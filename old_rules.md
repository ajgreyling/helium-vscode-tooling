This project is developed in Helium DSL, a domain specific language with Java-like syntax that runs on top of the Helium platform

# Directory Structure  
- Model files (objects, enum's and roles all in their own file): model/*.mez
- Validators: model/validators/*.mez
- Views: web-app/views/*.vxml 
- Presenters: web-app/presenters/*.mez
- Services/APIs: services/*.mez
- Reports: 
  - jasper-reports/*.jrxml
  - builtin-reports/*.jrxml
- SQL Scripts (PostgreSQL): sql-scripts/*
- Language/Translation File: web-app/lang/en.lang

# Model Files (.mez)
Model files contain the data model definitions using the .mez extension. They define data validators, enum types, custom objects and relationships between objects.
# Persistent Objects
Example of a persistent object in a model file Person.mez:
```
persistent object Person {
    string name;
    int age;
}
```
- Persistent objects are declared using the `persistent object`
- `.save()` method (with no arguments) for saving a new object or updating an existing object.
- `._id` property that contains the primary key uuid of the object.
- `.read(uuid)` method that returns the object with the given uuid key.
- `:new()` BIF creates a new instance of the object.
- `:delete(arg)` BIF that deletes the object from the database. Arg can be a uuid or object instance
- `beforeCreate` is used to set the attributes to specific values when the object is created. NOTE: Before the attribute is used, it is prefixed with `before.`
    ```
    persistent object Person {
        string name;
        int age;
        datetime created_at;
        datetime updated_at;
        bool archived;
        beforeCreate{
            before.created_at = Mez:now();
            before.updated_at = Mez:now();
            before.archived = false;
        }
    }
    ```

# Non-Persistent Objects
- Non-persistent objects are defined using the `object` keyword. They are not backed by the database and are used to store results from SQL queries, API calls and to define collections. Example of a non-persistent object in a model file Address.mez:
```
object Address {
    string street;
    string city;  
}
```
- `beforeCreate` is used to set the attributes to specific values when the object is created. NOTE: Before the attribute is used, it is prefixed with `before.`
    ```
    object Address {
        string street;
        string city;
        datetime created_at;
        datetime updated_at;
        bool archived;
        beforeCreate{
            before.created_at = Mez:now();
            before.updated_at = Mez:now();
            before.archived = false;
        }
    }
    
    ```
# Enums
Enumerations can be defined using the enum keyword in a model file Gender.mez:
```
enum GENDER {
    Male,
    Female
}
```
# Annotations

Annotations are used to provide metadata about model elements. Some common annotations include:

 `@Scheduled("* * * * *")`: Indicates the function is scheduled to run at the specified cron schedule.
 `@Role("System Admin")`: Specifies a Systen Admin user role 
 `@OneToOne`, `@OneToMany`, `@ManyToOne`, `@ManyToMany`: Define relationships between persistent objects. There is no [] after the type name. Declare the the relationships after the attributes.
 ```
 persistent object Child {
    string first_name;
    string last_name;
 }

 persistent object Parent {
    string first_name;
    string last_name;
    @OneToMany Child children via parent;
 }
 ```
 `@Validator <@ValidatorName>`: Specifies a validator for the attribute.  `validator.age` is the language file key for the failed validation message for the age validator in the language file in the following example:
``` 
persistent object Person {
    string first_name;
    string last_name;
    @AgeValidator("validator.age") 
    GENDER gender;

    @ManyToOne address address via person;
    @OneToMany child children via person;
}

validator AgeValidator {
    minval(0);
    maxval(120);
}
```
- Dot notation can only be used once in each statement. Instead of 
```
    rental.dvd_title.available_copies = rental.dvd_title.available_copies + 1;
    rental.dvd_title.save();
```
use the following syntax:
```
    DVD_Title rentalDvdTitle = rental.dvd_title;
    rentalDvdTitle.available_copies = rentalDvdTitle.available_copies + 1;
    rentalDvdTitle.save();
```
# Variables
Variables cannot be declared in the else block. They should be declared before the if statement. 

# Presenter Files (.mez)

Presenter files contain the logic for views and are defined using `unit <view name>;`. A unit groups related static variables and functions.
```
unit Foo;
string greeting;

void init() {
    greeting = "Hello World";
}

```
# Data Types
Helium DSL supports the following primitive data types:
- int, string, decimal, bigint, bool, date, datetime, uuid, void, blob, json, jsonarray

# Blob Type
- If a object has a blob field declared, the following metadata fields are automatically available as properties on the object: 
    - File name as "{blob field name}\_fname__"
    - Mime Type as "{blob field name}\_mtype__"
    - File Size in bytes as "{blob field name}\_size__" 

- The Blob type has `Blob:toString(blobField)` which returns a Base64 encoded string and `Blob:fromString(base64String)` which takes Base64 encoded string as input

# Control Structures
Helium DSL supports common control flow statements:
- `if/else if/else` for conditional branching. The condition has to be written as a equation. `if (isSometing) ` is not valid. Structure of a if statement:
```
bool boolVar1 = true;
bool boolVar2 = true;
if (boolVar1 == true) {
    // if 
} else if (boolVar2 == false){
    // else if
} else {
    // else
}
```
- `for` and `foreach` for looping
- `return` to return from a function
Structure of a foreach loop:
```
foreach(Some_Object currentObject: objectCollection) {
    currentObject.description = "Foreach style loop!";
}
```

# Functions
Functions are defined with a return type, name and optional parameters:
```
int add(int a, int b) {
    return a + b;
}
```
Static utility functions can be called on the type directly with a colon after the type name.
`string reversed = String:reverse("hello");`

String BIFs. Only the following BIFs are supported:
`string s = String:concat("abc","def");`
`string[] result = String:split("abc def", " ");`
`string[] result = String:split("abc|def", "\\|");`
`int i = String:length("Hello world");`
`string s = String:substring("Hello World", 1, 4);`
`string s = String:lower("Hello World");`
`string s = String:upper("hello world");`
`bool b = String:startsWith("Hello World", "Hello");`
`bool b = String:endsWith("Hello World", "World");`
`bool b = String:regexMatch("27000111222", "^27[0-9]{9,}$");`
`int i = String:indexOf("Hello World", "ello");`
`string s = String:join(stringCollection, " ");`
`string s = String:translate("translation.key");`
```string s = /%
    This is a
    multi line string
    declaration
%/;
```
`string encodedTest = String:urlEncode("The string ü@foo-bar");`
`string s = String:regexReplaceFirst("ab32c56desd111", "[0-9]", "X");`
`string s = String:regexReplaceAll("ab32c56desd111", "[0-9]", "X");`
`string s = String:replaceAll("Hello World", "l", "L");`

# Collection
Collections of a type can be defined using [] syntax. `Person[] people;`. Collection BIFs cannot be appended to a Selector BIF. Use seperate commands eg. 
```
Person[] plist = Person:all();
first_person = plist.first();
```
## Collection BIFs
- `Person p = plist.pop();`
- `Person p = plist.drop();`
- `int len = plist.length();`
- `Person first_person = plist.first();`
- `Person last_person = plist.last();`
- `plist.append(p);`
- `plist.prepend(p);`
- `plist.add(i, p);`
- `Person p = plist.get(i);`
- `plist.remove(i);`
- `plist.sortAsc("dob"); //sort according to date attr. "dob"`
- `plist.sortDesc("dob");`
- `plist.clear();`
- `plist.notify("description.key", "sms.content.key", "email.subj.key", "email.content.key");`
- `Person[] plist_doctors_subset = plist.select(equals(title, "Dr."));`

# Persistent Object Selector BIFs (Note, attributes are supplied without double quotes)
- Person[] plist = Person:all();
- Person[] plist = Person:equals(deleted, false);
- Person[] plist = Person:empty(mobileNum);
- Person[] plist = Person:between(dob, date1, date2);
- Person[] plist = Person:lessThanOrEqual(age, num);
- Person[] plist = Person:lessThan(age, num);
- Person[] plist = Person:greaterThan(age, num);
- Person[] plist = Person:attributeIn(state, state_list);
- Person[] plist = Person:relationshipIn(reports_to, person);
- Person[] plist = Person:contains(name, "a");
- Person[] plist = Person:beginsWith(name, "A");
- Person[] plist = Person:endsWith(name, "a");
- Person[] plist = Person:notEquals(deleted, true);
- Person[] plist = Person:notEmpty(mobileNum);
- Person[] plist = Person:notBetween(dob, date1, date2);
- Person[] plist = Person:notContains(name, "a");
- Person[] plist = Person:notBeginWith(name, "A");
- Person[] plist = Person:notEndsWith(name, "a");
- Person[] plist = Person:notAttributeIn(state, state_list);
- Person[] plist = Person:notRelationshipIn(reports_to, person);
- Person[] plist = Person:union(equals(rating, "good"), equals(rating, "excellent"));
- Person[] plist = Person:diff(equals(), equals());
- Person[] plist = Person:intersect(equals(deleted, false, equals(active, true));
- Person[] plist = Person:and(equals(deleted, false), equals(active, true));

- `:equals()` cannot be used to retrieve relationships. Use the relationshipIn and  notRelationshipIn instead.

Complex Selector BIFs
```
Person[] plist = Person:union(equals(rating, "good"), equals(rating, "excellent"));
Person[] plist = Person:diff(equals(), equals());
Person[] plist = Person:intersect(equals(deleted, false, equals(active, true));
Person[] plist = Person:and(equals(deleted, false), equals(active, true));
```

# Logging BIFs
The Mez namespace provides logging functions:
```
Mez:log(): Log at INFO level
Mez:warn(): Log at WARNING level
Mez:error(): Log at SEVERE level
```
# Navigation

The DSL_VIEWS enum represents the application views and is used for navigation. If the function returns null, the view will not be navigated to.
```
DSL_VIEWS navigateToHome() {
    if (validationPassed == true) {
        return DSL_VIEWS.Home;
    } else {
        return null;
    }
}
```
- Variables cannot be passed to the navigate BIF. Set the variable in the presenter instead.
```
# SQL
SQL queries can be executed using the sql:query() and sql:execute() BIFs:
```
Person[] people = sql:query("SELECT * FROM Person");
sql:execute("UPDATE Person SET age = 20");  
```
# Language/Translation File
web-app/lang/en.lang contains the language translation entries in INI format. Every view child element that has a `label` attribute must have an entry for the label value in the language file. There must be no duplicate entries in the language file considering the name before the "=" sign.

# Menu items
- The menu item for a view is declared as follows inside a `<view>`. The `userRole` attribute is a persistent object that is annotated with `@Role`
```
<menuitem label="menu_item.system_admin_home" icon="UserProfile" order="0">
	<userRole>System Admin</userRole>
</menuitem>
```
# Icons 
Icons referenced in the menu item are in .png format and are stored in web-app/images and have to be 40 pixels wide and 30 pixels high with a transparent background.

# Logical Operators
Only the following logical operators are supported:
\>  <  ==  >=  <=  !=

To test for an empty string use the following syntax:
`<string> == ""`

To test for a false value use the following syntax:
`<bool> == false`. The follwing is not allowed: `!<bool>`

# Naming Conventions
- All functions should be in camelCase.
- All unit and view names should be in PascalCase.
- All variables names should be in camelCase.
- All enums should be in UPPERCASE.
- All attributes/properties/fields should be in snake_case.
- All objects should be in Pascal_Snake_Case.

# Required Fields
-  View child elements do not have a `required` attribute. Required fields are implemented by adding a validator to the attribute. 

# Validators
- Validators are defined in the model/validators/*.mez file(s).
- Validators are defined using the validator keyword. 

## Validators are made up of the following BIFs:
- `notnull();` Check that the attribute is not null. This validator does not take any arguments. Only used inside model files to annotate the relevant attribute. Validators can not be used in the view files.
- `regex("\b[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,4}\b");`	//checks for a valid email address
- `minval(3.145);` 
- `maxval(6.18);` 
- `minlen(2);` 
- `maxlen(255);` 

# Null Checks
`<attribute> == null` 
`<attribute> != null`

# Language/translation file entries can be interpolated using the following syntax where currentCase is variable inside the function where the translation is called from:
`email.new_case_assignment.subject=Case Reference:{currentCase.reference}`


# Emails
```
void mailToAddress(Patient p){
    Mez:email(p.emailAddress, "email.descriptionKey", "email.subjectKey", "email.bodyKey"); //The last 3 arguments are the translation keys
}
```
# Math BIFs
- Math:random() // Returns a random decimal number between 0 and 1
- Math:sqrt(3); 
- Math:pow(2, 8);

# Integer operators
+= and -= are not supported. Use the following syntax instead:
```
int i = 1;
i = i + 1;
```
# Date functions
Only the following Date BIFs are supported for adding an integer value to a date:
- `Date:addSeconds(startDate, i)`
- `Date:addDays(startDate, i)`
- `Date:addMonths(startDate, i)`
Get an Interval Between Two Dates
- `Date:secondsBetween(startDate, endDate)`
- `Date:daysBetween(startDate, endDate)`
- `Date:monthsBetween(startDate, endDate)`
## Date conversions
- `date dt = Date:fromString("2013-01-02");`
- `datetime dt = Date:fromTimeString("2013-1-20 08:45:12 GMT");`
- `datetime dt = Date:fromUnixTimestamp(1631104351673l);`
## Extracting Date Components
- `int year = Date:extract(dt, "year"); //year = 2013`
- `int month = Date:extract(dt, "month"); //month = 1`
- `int day = Date:extract(dt, "day"); //day = 20`
- `int hour = Date:extract(dt, "hour"); //hour = 8`
- `int minute = Date:extract(dt, "minute"); //minute = 45`
- `int second = Date:extract(dt, "second"); //second = 12`
## Getting the current date and time
- `datetime t = Mez:now();`
- `date d = Mez:today();`

# Navigation
- The function should return the type DSL_VIEWS. Eg.
```
DSL_VIEWS navigateToHome() {
    return DSL_VIEWS.Home;
}
```
# User Roles
- Role_Name:user() returns the user object for the current user. Eg. `System_Admin currentUser = System_Admin:user()`.
Any persistent object that is annotated with @Role has these implicit attributes that is populated by the platform automatically: _firstNames, _nickName, _surname

# Type Conversions
- `int i = Integer:fromString(123);`
- `decimal d = Decimal:fromString("12.34");`
- `uuid id = Uuid:fromString(user._id);`

# Mez BIFs
- Mez:userRole() will return the friendly name of a role instance as a string. Eg "System Administrator": `Mez:userRole()`

# Others
- All methods are call by value. Arguments are not passed by reference.
- Ternary operator is not supported. Use if/else instead.
- Do not compound selectors. Use separate selectors instead.
- `random` is a reserved word. Use randomNumber instead for a variable name.
- `uuid()` is not supported. Use the following syntax to get the uuid of a new object. Dummy is a persistent object with only a single string attribute since models have to have at least one explicitly declared attribute:
```
    Dummy dummy = Dummy:new();
    uuid uuidValue = dummy._id;
```
- The lessThan, greaterThan, lessThanOrEqual, greaterThanOrEqual BIFs can only be used with int and decimal attributes. Use between for date and datetime attributes. 
- No string manipulation functions are supported. Use the String BIFs instead.
- Attributes of a persistent object can be accessed using the dot notation. Eg. `currentCase.title`. To obtain an attribute of a relationship, first assign the relationship to a variable and then access the attribute. Eg.
```
case_manager caseManager = currentCase;
emailAddress = caseManager.email_address;
```
- Attributes of a BIFs cannot be accessed with dot notation. Assign the result of a BIF to a variable and then access the attribute. Eg.
```
Person person = Person:new();
uuid personKey = person._id;
```
# SQL for inserting data
- Any persistent object has a implicit mandatory `_id_` and `_tstamp_` field on the database.
- The `_id_` field is a uuid and is automatically generated by the database when a new object is inserted with the `save()` method.
- The `_tstamp_` field is a datetime and is automatically generated by the database when a new object is inserted with the `save()` method.
- When inserting data with SQL, the `_id_` and `_tstamp_` fields are required to be included in the SQL statement. Use gen_random_uuid() to generate a uuid and now() to generate a datetime
- If a relationship is define in model file it will create a foreign key on the child object table in the database. The foreign key is the name of the relationship with _fk appended to the end.


# User notifications 
- Popup notifications are displayed using Mez:alert(), Mez:alertWarn() and Mez:alertError() where the argument is the language file key.
- `Mez:alert("alert.user_was_successfully_deleted");` Displays an information popup
- `Mez:alertWarn("warn.acction_cannot_be_undone");` Displays a warning popup
- `Mez:alertError("error.user_cannot_delete_self");` Displays an modal error popup
# View (.vxml)
- A view file uses XML to define the user interface and layout.
- Ensure the label attribute is present for all child elements and that a corresponding translation exists in the language file. 
- A view element can have the following child elements only: checkbox, datefield, fileupload, select, textarea, textfield, invite, code, filebrowser, gallery, info, map, table, wall, raw, menuitem
- All label attribute values in a view are keys in the language file.
- The value of the init attribute of a view is a function that is called without arguments when the view is initialized. If there is no logic in the function, omit the init attribute.
- The following XML and ui header is always present
```
<?xml version="1.0" encoding="UTF-8"?>
<ui xmlns="http://uiprogram.mezzanine.com/View"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://uiprogram.mezzanine.com/View View.xsd">
```
- Menu item in code below is for System Admin role. Ensure that a persistent object is annotated with `@Role` and that the role name matches the value of the userRole element.
- info element value attribute can be a dynamic value using a language file entry which can be interpolated Eg.`info.system_admin_welcome= Welcome {SystemAdminHome:firstName} {SystemAdminHome:lastName}`. Eg.
```
    <info label="info.welcome" value="info.system_admin_welcome"/> 
```
- info can only display a single attribute.
- info element can be bound to a function or a variable. Eg.
```
    <info label="info.email_address">
        <binding function="getSystemAdminEmailAddress"/>
    </info>
    <info label="info.mobile_number">
        <binding variable="mobileNumber"/>
    </info>
```
- Text field can be binded to a variable or a function. Eg.
```
    <textfield label="textfield.label.my_value">
        <binding variable="MyUnit:string_value" />
    </textfield>
```
- The datatype attribute is optional and defaults to text. Eg.
```
    <textfield label="textfield.label.my_value" datatype="text">
        <binding variable="MyUnit:string_value" />
    </textfield>
```
- Select element display values can be bound to an enum value. Eg.
```        
    <select label="select.state">
        <binding variable="farmer">
            <attribute name="state"/>
        </binding>
        <enum>STATES</enum>
    </select>
```
- Select display values can be bound to a collection returned by a function. It Can have multiple display attributes for compounded values Eg.
```
    <select label="select.shop_owner">
        <binding variable="ownerToAdd"/>
        <collectionSource function="getAllShopOwners">
            <displayAttribute name="firstName"/>
            <displayAttribute name="lastName"/>
        </collectionSource>
    </select>
```
- Select display values can be bound to a collection of strings variable. Eg.
```
    <select label="select.crop_type">
        <binding variable="selectedCropType"/>
        <collectionSource variable="cropTypes"/>
    </select>
```
- Select element dose NOT support the `datatype` attribute. Eg.
```
    <select label="select.crop_type" datatype="string">
        <binding variable="selectedCropType"/>
        <collectionSource variable="cropTypes"/>
        <datatype>string</datatype>
    </select>
```
- A rowAction child of table  defines a button on each row. Typically but not exclusively used for navigation or edit and delete operations. A table can have multiple rowaAction buttons. Prefer this over cellAction. A rowAction is bound to a variable declared as a global variable in a unit. The action function does not take any arguments.
```
    <rowAction label="button.select" action="select">
        <binding variable="uMenuItem"/>
    </rowAction>
```
- rowAction can have a optional visible attribute bound to a function or variable. This is used to conditionally show the rowAction button. rowAction can have a optional confirm element with subject and body that are language file keys.
```
<rowAction label="button.remove" action="removeUser">
    <binding variable="farmer" />
    <confirm subject="confirm_subject.removing_user" body="confirm_body.removing_user" />
    <visible function="showRemoveFarmerRowAction"/>
</rowAction>
```
- A table collectionSource can be bound to a variable. In this example the collectionSource is bound to the variable uMenuItems in the AbstractMenu unit.
```
        <table title="table_heading.menu_items_table">
            <collectionSource variable="AbstractMenu:uMenuItems"/>
            <column heading="column_heading.menu_name_col">
                <attributeName>name</attributeName>
            </column>
        </table>
```
- A table collectionSource can be bound to a function. In this example the collectionSource is bound to the function getAllMenuItems in the AbstractMenu unit.
```
        <table title="table_heading.menu_items_table">
            <collectionSource variable="AbstractMenu:getAllMenuItems"/>
            <column heading="column_heading.menu_name_col">
                <attributeName>name</attributeName>
            </column>
        </table>
```
- A column in a table can only contain a single attributeName.

- A textarea element can only contain a single binding containing a single attribute. textarea cannot contain rows or datatype attributes:
```
<textarea label="textarea.farm_address">
    <binding variable="farmer">
        <attribute name="farm_address"/>
    </binding>
</textarea>
```
- Example of textfield widget:
```
<textfield label="textfield.quantity_to_purchase">
    <visible function="showPurchaseForm"/>
    <binding variable="farmerPurchase">
        <attribute name="purchaseQuantity"/>
    </binding>
</textfield>
```
- In addition, the textfield widget provides a datatype attribute that can be used to slightly alter the behaviour of the text field widget. Possible values and their related behaviour is as follows:
  - datatype="number": Allows only numbers to be entered. Provides scroller buttons that increment and decrement the current value.
  - datatype="password": Displays a * character instead of the characters entered by the user in order to hide a password.
  - datatype="text": Default behaviour assuming the widget is bound to a basic data type that is not of type int.
  - datatype="tel": Provides additional validation for phone numbers.
  - datatype="email": Provides additional validation for email addresses.
  - datatype="url":Provides additional validation for URLs.

- The visible element is used to determine, at runtime, whether a widget or view element should be displayed on the frontend or not. It behaves much the same as the binding element except that its only purpose is to retrieve values from a unit variable or function and not to populate unit variables as with bindings for input widgets. The variables that are bound should be of type boolean and the functions that are bound should have a return type of boolean. Attributes of custom object unit variables can also be bound given that the attribute is of type boolean. If the values of the bound unit variable, attribute or function evaluates to true, the widget will be displayed and if it evaluates to false, it will not be displayed. By default, if <visible/> is not used in a widget, the widget is visible. This element should be the first element except for rowAction, where it should be the last. The following elements support the use of visibility bindings by means of the visible element:
  - textfield
  - textarea
  - datefield
  - checkbox
  - select
  - fileupload
  - info
  - filebrowser
  - map
  - table
  - wall
  - button
  - submit
  - action
  - column
  - rowAction
  - markerAction

- The following is a sample view file:
```
<?xml version="1.0" encoding="UTF-8"?>
<ui xmlns="http://uiprogram.mezzanine.com/View"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://uiprogram.mezzanine.com/View View.xsd">
	<view label="view_heading.shop_management" unit="ShopMgmt" init="initializeView">
        <menuitem label="menu_item.system_admin_home" icon="UserProfile" order="0">
            <userRole>System Admin</userRole>
        </menuitem>
        <info label="info.welcome" value="info.system_admin_welcome"/> 
        <info label="info.email_address">
            <binding function="getSystemAdminEmailAddress"/>
        </info>
        <info label="info.mobile_number">
            <binding variable="currentSystemAdminUser">
                <attribute name="mobileNumber"/>
            </binding>
        </info>
        <select label="select.state">
            <binding variable="farmer">
                <attribute name="state"/>
            </binding>
            <enum>STATES</enum>
        </select>
        <select label="select.shop_owner">
            <binding variable="ownerToAdd"/>
            <collectionSource function="getAllShopOwners">
                <displayAttribute name="firstName"/>
                <displayAttribute name="lastName"/>
            </collectionSource>
        </select>
        <select label="select.crop_type">
            <binding variable="selectedCropType"/>
            <collectionSource variable="cropTypes"/>
        </select>
        <table title="table_heading.menu_items_table">
            <collectionSource variable="AbstractMenu:uMenuItems"/>
            <column heading="column_heading.menu_name_col">
                <attributeName>name</attributeName>
            </column>
            <column heading="column_heading.menu_desc_col">
                <attributeName>description</attributeName>
            </column>
            <rowAction label="button.select" action="select">
                <binding variable="uMenuItem"/>
            </rowAction>
            <rowAction label="button.remove" action="removeUser">
                <binding variable="farmer" />
                <confirm subject="confirm_subject.removing_user" body="confirm_body.removing_user" />
                <visible function="showRemoveFarmerRowAction"/>
            </rowAction>            
        </table>       
        <table title="table_heading.menu_items_table">
            <collectionSource variable="AbstractMenu:getAllMenuItems"/>
            <column heading="column_heading.menu_name_col">
                <attributeName>name</attributeName>
            </column>
        </table>
	</view>
</ui>
```
# JSON handling
## Rule 1: Creating empty JSON objects and arrays
```
json createEmptyJson() {
    json emptyObject = "{}";
    jsonarray emptyArray = "[]";

}
```

## Rule 2: Adding key-value pairs to JSON objects
```
void addKeyValueToJson(json jsonObject, string key, string value) {
    jsonObject.jsonPut(key, value);
}
```
## Rule 3: Converting JSON arrays to and from regular arrays
```
json[] convertJsonArrayToArray(jsonarray jsonArr) {
    json[] regularArray = jsonArr;
    return regularArray;
}

jsonarray convertArrayToJsonArray(json[] regularArray) {
    jsonarray jsonArr = regularArray;
    return jsonArr;
}
```

## Rule 4: Accessing JSON values
```
string getJsonValue(json jsonObject, string key) {
    return jsonObject.jsonGet(key);
}

json getJsonObject(json jsonObject, string key) {
    return jsonObject.jsonGet(key);
}

jsonarray getJsonArray(json jsonObject, string key) {
    return jsonObject.jsonGet(key);
}
```

## Rule 5: Handling nested JSON
```
json createNestedJson() {
    json parentJson = "{}";
    json childJson = "{}";
    childJson.jsonPut("type", "string");
    childJson.jsonPut("description", "sample description");
    parentJson.jsonPut("child", childJson);
    return parentJson;
}
```

## Rule 6: Working with JSON arrays in objects
```
void appendToJsonArray(jsonarray arr, json element) {
    json[] tempArray = arr;
    tempArray.append(element);
    arr = tempArray;
}
```

## Rule 7: Converting string to JSON
```
json parseJsonString(string jsonString) {
    // Remove curly braces if present
    int stringLength = String:length(jsonString);
    if (stringLength > 2) {
        jsonString = String:substring(jsonString, 1, stringLength - 2);
    }
    json parsedJson = jsonString;
    return parsedJson;
}
```
## Rule 8: Handling first element of JSON array
```
json getFirstElement(jsonarray arr) {
    json[] tempArray = arr;
    if (tempArray.length() > 0) {
        return tempArray.first();
    }
    return "{}";
} 
```
## Rule 9: Determine whether a specific property is already present in the json variable
```
// JSON representing contact details
json jsonContactDetails = "{}";
jsonContactDetails.jsonPut("phoneNumber", "555-6162");
jsonContactDetails.jsonPut("emailAddress", "john.smith@gmail.com");
 
// This will evaluate to true since the property is present
bool containsPhoneNumber = jsonContactDetails.jsonContains("phoneNumber");
 
// This will evaluate to false since the property is not present
bool containsNickname = jsonContactDetails.jsonContains("nickname");
```

## Rule 10: To remove an individual property from a json variable, the jsonRemove built-in function can be used: 
```
// JSON representing contact details
json jsonContactDetails = "{}";
jsonContactDetails.jsonPut("phoneNumber", "555-6162");
jsonContactDetails.jsonPut("emailAddress", "john.smith@gmail.com");
 
// This will evaluate to true since the property is present
bool containsPhoneNumber = jsonContactDetails.jsonContains("phoneNumber");
 
// This will remove the mobile number property
jsonContactDetails.jsonRemove("phoneNumber");
 
// This will now evaluate to false since the property has been removed
containsPhoneNumber = jsonContactDetails.jsonContains("phoneNumber");
```

## Rule 11: To get a collection of json property names for a json variable, the jsonKeys built-in function can be used:
```
// JSON representing contact details
json jsonContactDetails = "{}";
jsonContactDetails.jsonPut("phoneNumber", "555-6162");
jsonContactDetails.jsonPut("emailAddress", "john.smith@gmail.com");
 
// This will return a collection of strings representing the property names
// ["phoneNumber", "emailAddress"]
string[] keys = jsonContactDetails.jsonKeys();
 
// Keys can be used to iterate over all the properties
foreach(string key: keys) {
    string value = jsonContactDetails.jsonGet(key);
}
```