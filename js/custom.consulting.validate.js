//constraints which are applied on the form field
let constraints = {
    firstname: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 50
        }
    },
    email: {
        presence: true,
        email: true
    }
};

var locations = $('input:radio[name=location]');
var work_authorization = $('input:radio[name=work_authorization]');
var tech_stack_other = $('input#tech_stack_other');
var have_cto = $('input:radio[name=have_cto]');
var tech_stack = $('input:checkbox[name=tech_stack]');


var other_locations = document.querySelector('input#other_locations');
var onsite_95_remote = document.querySelector('input#onsite_95_remote');
var other_work_authorization = document.querySelector('input#other_work_authorization');
var hiring_categories = document.querySelector('label[for=have_cto]');
var cto_name = document.querySelector('input#cto_name');


var other_tech_stack_input = document.querySelector('input#other_tech_stack');

locations.change(function(){
    if(this.value.includes('Other')){
        other_locations.classList.remove('hidden');
        onsite_95_remote.classList.add('hidden');
    } else if (this.value.includes("95% Remote Onsite")){
       onsite_95_remote.classList.remove('hidden');
       other_locations.classList.add('hidden');
    } 
    else{
        other_locations.classList.add('hidden');
        onsite_95_remote.classList.add('hidden');
    }
});

other_locations.addEventListener('change', function () {
    change_others_values.bind(this,'Others: ')()
})
onsite_95_remote.addEventListener('change', function(){
    change_others_values.bind(this,'95% Remote Onsite and other as: ')()
})

function change_others_values(prefixValue){
    var temp = this.previousElementSibling;
    temp.value = prefixValue
    temp.value += " " + this.value;
}

tech_stack.change(function() {
    if(!other_tech_stack_input.previousElementSibling.checked){
        other_tech_stack_input.previousElementSibling.value = 'Others: ';
        other_tech_stack_input.value =''
    } 
})

tech_stack_other.change(function() {
    other_tech_stack_input.classList.toggle('hidden')
});

other_tech_stack_input.addEventListener('change',function(){
    change_others_values.bind(this,'Others: ')()
})


have_cto.change(function() {
    if(this.value.includes('Yes')) {
        cto_name.classList.remove('hidden')
    } else {
        cto_name.classList.add('hidden')
    }
})

work_authorization.change(function() {
    if(this.value.includes('Other')){
        other_work_authorization.classList.remove('hidden');
    } else{
        other_work_authorization.classList.add('hidden')
    }
})

cto_name.addEventListener('change', function () {
    change_others_values.bind(this, 'Yes, CTO_Name:' )()
})
other_work_authorization.addEventListener('change', function () {
    change_others_values.bind(this, 'Others:')()
})


var check_boxes = ['hiring_categories', 'assistance_type','tech_stack']
function checkbox_values(check_boxes) {
    check_boxes.forEach(a => {
        var inputs = document.querySelectorAll(`input[name=${a}]:checked`);
        var label = document.querySelector(`label[for=${a}]`);
        var input_value = '';
        inputs.forEach((input) => {
            input_value += input.value +', ';
        });
        label.value = input_value ? input_value.slice(0,-2): input_value;
        if (inputs) {

        }
    })
}

var radio_fields = ['financial_stage',
    'recruitement_type',
    'have_cto',
    'upto_role',
    'is_assistance_required',
    'assistance_type',
    'location',
    'work_authorization',
    'cloud_stack',
]
function radio_fields_values(radio_fields) {
    radio_fields.forEach(a => {
        var input = document.querySelector(`input[name=${a}]:checked`);
        var label = document.querySelector(`label[for=${a}]`);
        if(input){
            label.value = input.value;
        }
    })
}

var inputs = document.querySelectorAll("input.sm-form-control, textarea, select.sm-form-control");
inputs.forEach( input => {
        input.addEventListener("change", function (ev) {
            var errors = validate(form, constraints) || {};
            showErrorsForInput(this, errors[this.name])
        });
    }
)


var form = document.querySelector("form#template-contactform");
form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    let a = $("form#template-contactform");
    console.log(a.serialize());
    checkbox_values(check_boxes);
    radio_fields_values(radio_fields)
    console.log(hiring_categories.value)
    // handleFormSubmit(form);
});

//it handles the form submit
function handleFormSubmit(form, input) {
    // validate the form against the constraints
    var errors = validate(form, constraints);
    // then we update the form to reflect the results
    showErrors(form, errors || {});
    if (!errors) {
        showSuccess();
    } else {
        swal.fire({
            title: "Form Error",
            text: "Please ensure all fields are correct!",
            type: "error",
            confirmButtonText: "Ok",
        })
    }
}

function showErrors(form, errors) {
    // We loop through all the inputs and show the errors for that input
    form.querySelectorAll("input.sm-form-control, select.sm-form-control").forEach(function (input) {
        showErrorsForInput(input, errors && errors[input.name]);
    });
}

function showErrorsForInput(input, errors) {
    var formGroup = input.parentNode;
    resetFormGroup(formGroup);
    if (errors) {
        formGroup.classList.add("has-error");
        formGroup.querySelector('input, select, textarea').classList.add('error')
        errors.forEach(function (error) {
            addError(formGroup, error);
        });
    } else {
        formGroup.querySelector('input, select, textarea').classList.remove('error');
    }
}


// function to remove errors from the form
function resetFormGroup(formGroup) {
    formGroup.classList.remove("has-error");
    formGroup.classList.remove("has-success");
    formGroup.querySelectorAll(".custom-error").forEach(function (el) {
        el.remove();
    });
}

//logic to add error into the form
function addError(formGroup, error) {
    let errorMessage = document.createElement('small');
    errorMessage.style.position = 'absolute';
    errorMessage.style.color = '#ea205a';
    errorMessage.innerText = error;
    errorMessage.classList.add('custom-error');
    formGroup.appendChild(errorMessage);
}

//function to reset the form
function resetForm(){
    document.querySelectorAll('form input.sm-form-control, select.sm-form-control, textarea').forEach(input => {
        input.value = '';
    })
}


// this function handles success if form is valid
function showSuccess() {    
    grecaptcha.ready(function () {
        grecaptcha.execute("6LcHIYcUAAAAAPnqH0iBwnDeFma0mWAMJKJHAoEO").then(function (token) {
            document.querySelector('input[name=token]').value = token;
            let a = $('form#template-contactform');
            console.log(a.serialize())
            $.ajax({
                type: a.attr('method'),
                url: a.attr('action'),
                data: a.serialize(),
                success: function (data, textStatus, xhr) {
                    console.log(xhr.status)
                    if (xhr.status === 200) {
                        swal.fire({
                            title: "Thank You!",
                            type: "success",
                            confirmButtonText: 'Ok'
                        });
                        resetForm();
                    } else {
                        swal.fire({
                            title: "Some Error Occurred!",
                            type: "error",
                            confirmButtonText: 'Ok'
                        });
                    }
                },
                error: function (data) {
                    swal.fire({
                        title: "An unexpected Error Occurred!",
                        type: "error",
                        confirmButtonText: 'Ok'
                    })
                },
            })
        });
    });
}

