import React, { PureComponent } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  TouchableHighlight,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Text,
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';

import Icon from 'react-native-vector-icons/FontAwesome';
import DeviceInfo from 'react-native-device-info';
import Modal from 'react-native-simple-modal';
import t from 'tcomb-form-native';

var Form = t.form.Form;

const CZOOM = t.enums({
  'medium': 'Medium',
  'low': 'Low',
}, 'CZOOM');

var options = {
  fields: {
    draggable_pins: {
      label: 'Pins can be moved',
      help: 'Your device\'s GPS may drop pins with low accuracy. Enabling this allows you to drag-and-drop pins.',
    },
    pin_clustering_zoom: {
      label: 'Pin Clustering Zoom',
      help: 'The zoom level of the map in which the pins start to cluster together. Lowering this may cause the map to be slow.',
      nullOption: {value: '', text: 'High'},
    },
    show_only_my_turf: {
      label: 'Show only my turf',
      help: 'If you don\'t want to see the progress of others with this form, enable this option.',
    },
    sync_on_cellular: {
      label: 'Sync over cellular',
      help: 'Allow syncing of data over your cellular connection. Data rates may apply.',
    },
    auto_sync: {
      label: 'Automatially sync data',
      help: 'Data will sync automatically as you canvass, if you\'ve allowed syncing over cellular, or are connected to wifi.',
    },
    share_progress: {
      label: 'Share progress',
      help: 'If enabled, syncing your device will allow all your canvassers to see each other\'s progress on thier devices after they sync too.',
    },
    only_export_home: {
      label: 'Only export taken surveys',
      help: 'When you export your data, this makes it so \'not home\' and \'not interested\' don\'t show up in the spreadsheet.',
    },
  },
};

export default class App extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      refer: props.navigation.state.params.refer,
      exportRunning: false,
    };

    this.onChange = this.onChange.bind(this);
  }

  onChange(canvassSettings) {
    const { refer } = this.state;

    if (refer.state.canvassSettings.share_progress !== true && canvassSettings.share_progress === true) {
      Alert.alert(
        'Data Sharing',
        '"Share progress" enables anyone who you shared your canvassing form with to see everyone\'s progress. Local laws in your area may govern with whom you may share name and address information. It is your responsibility to make sure you are in compliance with the law. Are you sure you wish to enable this option?',
        [
          {text: 'Yes', onPress: () => {
            refer._setCanvassSettings(canvassSettings);
            setTimeout(() => this.forceUpdate(), 500);
          }},
          {text: 'No', onPress: () => this.forceUpdate()}
        ], { cancelable: false });
    } else {
      refer._setCanvassSettings(canvassSettings);
    }

    setTimeout(() => this.forceUpdate(), 500);
  }

  render() {
    const { refer } = this.state;

    let formOpt = {
      'draggable_pins': t.Boolean,
      'pin_clustering_zoom': CZOOM,
    };

    if (refer.state.dbx) {
      formOpt.show_only_my_turf = t.Boolean;
      formOpt.sync_on_cellular =  t.Boolean;
      formOpt.auto_sync = t.Boolean;
    };

    // additional settings for the form owner
    if (refer.state.dbx && refer.state.user.dropbox.account_id === refer.state.form.author_id) {
      formOpt['share_progress'] = t.Boolean;
      formOpt['only_export_home'] = t.Boolean;
    }

    let mainForm = t.struct(formOpt);

    return (
      <ScrollView style={{flex: 1, padding: 15, backgroundColor: 'white'}}>

        <View style={{flex: 1, alignItems: 'flex-end'}}>
          <Text>Your device ID is:</Text>
          <Text>{DeviceInfo.getUniqueID()}</Text>
        </View>

        <View style={{
            width: Dimensions.get('window').width,
            height: 1,
            backgroundColor: 'lightgray',
            margin: 10,
          }}
        />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Form
           ref="mainForm"
           type={mainForm}
           options={options}
           onChange={this.onChange}
           value={refer.state.canvassSettings}
          />
        </TouchableWithoutFeedback>

        <View style={{
            width: Dimensions.get('window').width,
            height: 1,
            backgroundColor: 'lightgray',
            margin: 10,
          }}
        />

      </ScrollView>
    );
  }
}

var styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 30,
    alignSelf: 'center',
    marginBottom: 30
  },
  buttonText: {
    fontSize: 18,
    color: 'white',
    alignSelf: 'center'
  },
  button: {
    height: 36,
    backgroundColor: '#48BBEC',
    borderColor: '#48BBEC',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'stretch',
    justifyContent: 'center'
  }
});
