import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import PlacesSearch from '@justinjoyn/places-search';

const API_KEY = '';
const LOCATION = '33.783681, -118.115839';
const LANGUAGE = 'en';

const App = () => {
    const [palces, setPalces] = useState(null);

    const onSearch = (keyword) => {
        fetch('https://5f3555a35b91f60016ca4bea.mockapi.io/places')
            .then((response) => response.json())
            .then((response) => {
                setPalces(response);
            });
    };

    return (
        <>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={styles.container}>
                <PlacesSearch
                    types={['restaurant', 'food']}
                    debounce={1000}
                    onSearch={onSearch}
                    externalResults={palces}
                    autoFocus={true}
                    nearbyApiParams={{
                        key: API_KEY,
                        location: LOCATION,
                        rankby: 'distance',
                        type: 'restaurant',
                        language: LANGUAGE
                    }}
                    textSearchApiParams={{
                        key: API_KEY,
                        location: LOCATION,
                        region: 'us',
                        type: 'restaurant',
                        language: LANGUAGE
                    }}
                    autoCompleteApiParams={{
                        key: API_KEY,
                        location: LOCATION,
                        origin: LOCATION,
                        radius: 50000,
                        types: 'establishment',
                        language: LANGUAGE
                    }}
                    detailApiParams={{
                        key: API_KEY
                    }}
                />
            </SafeAreaView>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#505050'
    }
});

export default App;
