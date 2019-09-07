import React, { Component } from "react";
import { browserHistory } from 'react-router';
import Swal from 'sweetalert2/dist/sweetalert2.js';
import 'sweetalert2/src/sweetalert2.scss';

export default class Subscribe extends Component {
    constructor() {
        super();
        this.state = {
            email: "",
            selected: [],
            campaigns: ["The Ballot Box ($15)", "Sketch Requests ($25)", "Critique ($50)", "Online Class ($100)", "Exclusive Commissions ($400)", "Unsubscribe from all email lists"]
        }
        this.renderOptions.bind(this);
        this.itemClick.bind(this);
        this.validate.bind(this);
    }
  componentDidMount() {
    browserHistory.push('/subscribe');
  }

  itemClick(text) {
    var newSelect = this.state.selected;
    var index = newSelect.indexOf(text);
    if (index > -1) {
        newSelect.splice(index, 1);
        this.setState({selected: newSelect});
        return;
    }

    if (text === "Unsubscribe from all email lists") {
        this.setState({selected: ["Unsubscribe from all email lists"]});
        return;
    }

    if (this.state.selected.length == 1 && this.state.selected[0] == "Unsubscribe from all email lists") {
        this.setState({selected: [text]});
        return;
    }

    newSelect.push(text);
    this.setState({selected: newSelect});
    return;
  }

  validate() {
    var email = this.state.email;
    if (email.split('@').length != 2 || email.split('.').length < 2 || (email.split('@'))[1].split('.').length < 2) {
        Swal.fire("Invalid email, check spelling and format and try again.");
        return;
    }

    if (this.state.selected.length === 0) {
        Swal.fire("Select at least one option to submit.");
        return;
    }

    var dispatch = {
        email: email,
        selected: this.state.selected
    };
    fetch('/api/subscribe', {
        headers: {
            "Content-Type": "application/json"
          },
        method: "post",
        body: JSON.stringify(dispatch)
    })
        .then(res => res.json())
        .then(res => {Swal.fire(res.text)});

  }

  renderOptions() {
    return this.state.campaigns.map(text => 
        <SubItem key={text} selected={this.state.selected} text={text} handleClick={(e) => this.itemClick(e)}></SubItem>);
  }

  render() {
    return (
      <div id="subscribe">
        <h1>Email lists</h1>
        <h3>Select all tiers you'd like to be notified for when a slot opens</h3>
        <input onChange={(e) => {this.setState({email: e.target.value})}} type={"text"} placeholder={"email address"}></input>
        <div id={"options"}>{this.renderOptions()}</div>
        <button onClick={() => this.validate()} id={"subSubmit"}>Submit</button>
        <h6>Your selections will automatically overwrite any previous subscriptions</h6>
      </div>
    );
  }
}

class SubItem extends Component { 
    constructor(props) {
        super(props);
        this.getStyle.bind(this);
    }
    getStyle() {
        for (var i = 0; i < this.props.selected.length; i++) {
            if (this.props.text === this.props.selected[i]) {
                return {"boxShadow": "0 5px 15px white"}
            }
        }
            return {};
    }

    render() {
        return (
            <div onClick={(e) => this.props.handleClick(this.props.text)} style={this.getStyle()} className="option">
            {this.props.text}
            </div>
        );
    }
}