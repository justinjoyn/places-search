import { debounce, intersection, uniqBy } from 'lodash';
import Qs from 'qs';
import React, { Component } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api/place';
const GOOGLE_NEARBY_API = `${GOOGLE_PLACES_API}/nearbysearch/json`;
const GOOGLE_TEXT_SEARCH_API = `${GOOGLE_PLACES_API}/textsearch/json`;
const GOOGLE_AUTOCOMPLETE_API = `${GOOGLE_PLACES_API}/autocomplete/json`;
const GOOGLE_QUERY_AUTOCOMPLETE_API = `${GOOGLE_PLACES_API}/queryautocomplete/json`;

class PlacesSearch extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searchTerm: '',
            searchResults: [],
            searching: false,
            error: null
        };

        this.processResults = this.processResults.bind(this);
        this.searchPlace = debounce(this.searchPlace, 1000);
    }

    get allSearchResults() {
        const localResutls = this.state.searchResults?.length > 0 ? this.state.searchResults : [];
        const externalResults = this.props.externalResults?.length > 0 ? this.props.externalResults : [];
        return [...localResutls, ...externalResults];
    }

    setSearchTerm(text) {
        this.setState({ searchTerm: text });
        if (text && text.length >= 2) {
            this.setState({ searching: true });
            this.searchPlace();
        } else {
            this.searchPlace.cancel();
            this.setState({ searchResults: [], searching: false });
        }
    }

    searchPlace() {
        const { nearbyApiParams, textSearchApiParams, autoCompleteApiParams, queryAutoCompleteApiParams } = this.props;
        const { searchTerm } = this.state;

        this.props.onSearch(searchTerm);
        const searchPromises = [];

        if (autoCompleteApiParams?.key) {
            const params = Qs.stringify({ ...autoCompleteApiParams, input: searchTerm });
            searchPromises.push(fetch(`${GOOGLE_AUTOCOMPLETE_API}?${params}`));
        }

        if (nearbyApiParams?.key && nearbyApiParams?.location && (nearbyApiParams.radius || nearbyApiParams.rankby)) {
            const params = Qs.stringify({ ...nearbyApiParams, keyword: searchTerm });
            searchPromises.push(fetch(`${GOOGLE_NEARBY_API}?${params}`));
        }

        if (queryAutoCompleteApiParams?.key) {
            const params = Qs.stringify({ ...queryAutoCompleteApiParams, input: searchTerm });
            searchPromises.push(fetch(`${GOOGLE_QUERY_AUTOCOMPLETE_API}?${params}`));
        }

        if (textSearchApiParams?.key) {
            const params = Qs.stringify({ ...textSearchApiParams, query: searchTerm });
            searchPromises.push(fetch(`${GOOGLE_TEXT_SEARCH_API}?${params}`));
        }

        if (searchPromises.length > 0) {
            Promise.all(searchPromises)
                .then(function (responses) {
                    return Promise.all(
                        responses.map(function (response) {
                            return response.json();
                        })
                    );
                })
                .then(this.processResults)
                .catch(function (error) {
                    this.setState({ searchResults: null, searching: false, error: error });
                });
        }
    }

    processResults(data) {
        const results = this.aggregateResults(data);
        this.setState({ searchResults: results, searching: false });
    }

    aggregateResults(data) {
        const results = [];
        if (data && data.length > 0) {
            data.forEach((response) => {
                if (response.status === 'OK') {
                    if (response?.results && response.results?.length > 0) {
                        response.results.forEach((result) => {
                            const matchedTypes = intersection(this.props.types, result.types);
                            if (result.place_id && matchedTypes.length > 0) {
                                results.push({
                                    place_id: result.place_id,
                                    name: result.name,
                                    types: result.types,
                                    address: result.formatted_address || result.vicinity
                                });
                            }
                        });
                    } else if (response?.predictions && response.predictions?.length > 0) {
                        response.predictions.forEach((result) => {
                            const matchedTypes = intersection(this.props.types, result.types);
                            if (result.place_id && matchedTypes.length > 0) {
                                results.push({
                                    place_id: result.place_id,
                                    name: result.structured_formatting?.main_text,
                                    types: result.types,
                                    address: result.structured_formatting?.secondary_text
                                });
                            }
                        });
                    }
                }
            });
        }
        return uniqBy(results, 'place_id');
    }

    renderResultItem(item, index) {
        if (this.props.renderResultItem) return this.props.renderResultItem(item, index);
        return (
            <View style={styles.resultItemContainer}>
                <Text style={styles.placeName}>{item.name}</Text>
                <Text style={styles.palceAddress}>{item.address}</Text>
            </View>
        );
    }

    resultKeyExtractor(item, index) {
        if (this.props.resultKeyExtractor) return this.props.resultKeyExtractor(item, index);
        return item.place_id;
    }

    renderDivider() {
        if (this.props.renderListDivider) return this.props.renderListDivider();
        return <View style={styles.divider} />;
    }

    renderListEmptyComponent() {
        const { searchTerm, searching } = this.state;
        if (this.props.renderListEmptyComponent) return this.props.renderListEmptyComponent(searchTerm, searching);
        return (
            <View style={styles.listEmptyView}>
                <Text style={styles.listEmptyText}>
                    {searching
                        ? `Searching for places...`
                        : searchTerm !== ''
                        ? `Sorry, we couldn't find any places matching "${searchTerm}"`
                        : 'Start typing to search for places'}
                </Text>
            </View>
        );
    }

    renderListFooterComponent() {
        const { searchTerm, searching } = this.state;
        if (this.props.renderListFooterComponent) return this.props.renderListFooterComponent(searchTerm, searching);
        return null;
    }

    render() {
        const { containerStyle, inputStyle, resultsContainerStyle, autoFocus } = this.props;
        return (
            <View style={[styles.container, { ...containerStyle }]}>
                <TextInput
                    autoFocus={autoFocus}
                    placeholder={'Search'}
                    placeholderTextColor={'#DDD'}
                    onChangeText={(text) => this.setSearchTerm(text)}
                    style={[styles.searchInput, { ...inputStyle }]}
                />
                <FlatList
                    showsVerticalScrollIndicator={false}
                    data={this.allSearchResults}
                    renderItem={({ item, index }) => this.renderResultItem(item, index)}
                    keyExtractor={(item, index) => this.resultKeyExtractor(item, index)}
                    style={styles.resultsList}
                    ItemSeparatorComponent={() => this.renderDivider()}
                    contentContainerStyle={[styles.listContainer, { ...resultsContainerStyle }]}
                    ListEmptyComponent={() => this.renderListEmptyComponent()}
                    ListFooterComponent={() => this.renderListFooterComponent()}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        padding: 16
    },
    searchInput: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#FFF',
        borderRadius: 6,
        color: '#000'
    },
    resultsList: {
        flex: 1
    },
    listContainer: {
        paddingTop: 16,
        paddingBottom: 50
    },
    resultItemContainer: {
        flexDirection: 'column',
        paddingVertical: 4
    },
    placeName: {
        fontSize: 16,
        marginBottom: 4,
        color: '#FFFFFF'
    },
    palceAddress: {
        fontSize: 12,
        color: '#F0F0F0'
    },
    divider: {
        backgroundColor: '#555555',
        height: StyleSheet.hairlineWidth,
        marginVertical: 4
    },
    listEmptyView: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    listEmptyText: {
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center'
    }
});

PlacesSearch.defaultProps = {
    autoFocus: false,
    debounce: 1000,
    editable: true,
    types: [],
    onSelectPlace: null,
    containerStyle: {},
    inputStyle: {},
    resultsContainerStyle: {},
    renderResultItem: null,
    resultKeyExtractor: null,
    renderListDivider: null,
    renderListEmptyComponent: null,
    renderListFooterComponent: null,
    onSearch: null,
    externalResults: null,
    nearbyApiParams: {
        key: null,
        location: null,
        radius: null,
        rankby: null
    },
    textSearchApiParams: {
        key: null,
        query: null
    },
    autoCompleteApiParams: {
        key: null,
        input: null
    },
    queryAutoCompleteApiParams: {
        key: null,
        input: null
    },
    detailApiParams: {
        key: null,
        place_id: null
    }
};

export default PlacesSearch;
