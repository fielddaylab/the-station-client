'use strict'

import React from 'react';

import {
    TouchableOpacity,
    ImageBackground,
} from 'react-native';
import { Text } from './styles';

class SplashScreen extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.inSplash)
            return (
                <ImageBackground
                    source={require('../web/assets/img/splash.png')}
                    style={{
                        // flex: 1,
                        position: 'absolute',
                        width: '100%',
                        height: '105%',
                        backgroundColor: 'white',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        flexDirection: 'column',
                        zIndex: 10
                    }}
                    imageStyle={{
                        resizeMode: 'cover',
                    }}
                >
                    <TouchableOpacity onPress={
                        this.props.onCloseSplash
                    }
                        style={{
                            backgroundColor: 'white',
                            padding: 20,
                            borderRadius: 5,
                            margin: 30,
                            paddingLeft: 15,
                            paddingRight: 15,
                            shadowColor: '#5D0D0D',
                            shadowOpacity: 0.3,
                            shadowRadius: 6,
                            shadowOffset: { height: 2 },
                        }}>
                        <Text style={{
                            color: 'rgb(99,112,51)',
                            fontSize: 20,
                            textTransform: 'uppercase',
                            fontFamily: 'LeagueSpartan-Bold',
                        }}>
                            Begin
                        </Text>
                    </TouchableOpacity>

                </ImageBackground>
            );
        else return null
    }
}

export default SplashScreen