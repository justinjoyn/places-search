import { debounce, intersection, uniqBy } from 'lodash';
import PropTypes from 'prop-types';
import Qs from 'qs';
import React, { Component } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableHighlight,
    TouchableOpacity,
    View
} from 'react-native';

const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api/place';
const GOOGLE_NEARBY_API = `${GOOGLE_PLACES_API}/nearbysearch/json`;
const GOOGLE_TEXT_SEARCH_API = `${GOOGLE_PLACES_API}/textsearch/json`;
const GOOGLE_AUTOCOMPLETE_API = `${GOOGLE_PLACES_API}/autocomplete/json`;
const GOOGLE_QUERY_AUTOCOMPLETE_API = `${GOOGLE_PLACES_API}/queryautocomplete/json`;
const GOOGLE_DETAIL_API = `${GOOGLE_PLACES_API}/details/json`;

class PlacesSearch extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searchTerm: '',
            searchResults: [],
            searching: false,
            error: null,
            fetchingDetail: false,
            selectedPlaceId: null
        };

        this.processResults = this.processResults.bind(this);
        this.searchPlace = debounce(this.searchPlace, this.props.debounce);
    }

    get allSearchResults() {
        const localResutls = this.state.searchResults?.length > 0 ? this.state.searchResults : [];
        const externalResults = this.props.externalResults?.length > 0 ? this.props.externalResults : [];
        return [...localResutls, ...externalResults];
    }

    setSearchTerm(text) {
        this.setState({ searchTerm: text });
        if (text && text.length >= this.props.minLength) {
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
        } else {
            this.setState({ searchResults: [], searching: false });
        }
    }

    processResults(data) {
        const results = this.aggregateResults(data);
        this.setState({ searchResults: results, searching: false });
    }

    aggregateResults(data) {
        const results = [];
        if (data && data.length > 0) {
            data.forEach((response, index) => {
                if (response.status === 'OK') {
                    if (response?.results && response.results?.length > 0) {
                        response.results.forEach((result) => {
                            const matchedTypes = intersection(this.props.types, result.types);
                            if (result.place_id && (matchedTypes.length > 0 || this.props.types.length === 0)) {
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
                            if (result.place_id && (matchedTypes.length > 0 || this.props.types.length === 0)) {
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

    onSelect(item) {
        const params = Qs.stringify({ ...this.props.detailApiParams, place_id: item.place_id });
        if (this.props.onSelect) {
            this.setState({
                fetchingDetail: true,
                selectedPlaceId: item.place_id
            });
            fetch(`${GOOGLE_DETAIL_API}?${params}`)
                .then((response) => response.json())
                .then((response) => {
                    this.setState({
                        fetchingDetail: false,
                        selectedPlaceId: null
                    });
                    this.props.onSelect(item, response.result);
                });
        }
    }

    renderResultItem(item, index) {
        const { selectedPlaceId, fetchingDetail } = this.state;
        if (this.props.renderResultItem) return this.props.renderResultItem(item, index);
        return (
            <TouchableHighlight onPress={() => this.onSelect(item)}>
                <View style={styles.resultItem}>
                    <View style={styles.resultItemContainer}>
                        <Text style={styles.placeName}>{item.name}</Text>
                        <Text style={styles.palceAddress}>{item.address}</Text>
                    </View>
                    {selectedPlaceId === item.place_id && fetchingDetail && (
                        <ActivityIndicator color={'#FFF'} size={'small'} />
                    )}
                </View>
            </TouchableHighlight>
        );
    }

    resultKeyExtractor(item, index) {
        if (this.props.resultKeyExtractor) return this.props.resultKeyExtractor(item, index);
        return `${item.place_id}_${index}`;
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
        const {
            containerStyle,
            inputStyle,
            resultsContainerStyle,
            autoFocus,
            placeholder,
            returnKeyType,
            placeholderTextColor
        } = this.props;
        const { fetchingDetail } = this.state;
        return (
            <View style={[styles.container, { ...containerStyle }]}>
                <View style={styles.textInputContainer}>
                    <TextInput
                        editable={!fetchingDetail}
                        autoFocus={autoFocus}
                        placeholder={placeholder}
                        placeholderTextColor={placeholderTextColor}
                        returnKeyType={returnKeyType}
                        onChangeText={(text) => this.setSearchTerm(text)}
                        style={[styles.searchInput, { ...inputStyle }]}
                    />
                    <TouchableOpacity
                        disabled={fetchingDetail}
                        onPress={() => this.props.onCancel()}
                        style={styles.cancelButton}
                        activeOpacity={0.8}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    keyboardShouldPersistTaps={'handled'}
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
    textInputContainer: {
        flexDirection: 'row'
    },
    searchInput: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#FFF',
        borderRadius: 6,
        width: '80%',
        color: '#000',
        flex: 1
    },
    cancelButton: {
        justifyContent: 'center',
        marginLeft: 8
    },
    cancelButtonText: {
        color: '#FFF',
        textAlign: 'right',
        fontSize: 18
    },
    resultsList: {
        flex: 1
    },
    listContainer: {
        paddingTop: 16,
        paddingBottom: 50
    },
    resultItem: {
        flexDirection: 'row'
    },
    resultItemContainer: {
        flexDirection: 'column',
        paddingVertical: 4,
        flex: 1
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
        height: 1,
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

PlacesSearch.propTypes = {
    onSearch: PropTypes.func,
    onSelect: PropTypes.func,
    onCancel: PropTypes.func,
    onSelectPlace: PropTypes.func,
    renderResultItem: PropTypes.func,
    resultKeyExtractor: PropTypes.func,
    renderListDivider: PropTypes.func,
    renderListEmptyComponent: PropTypes.func,
    renderListFooterComponent: PropTypes.func,
    autoFocus: PropTypes.bool,
    debounce: PropTypes.number,
    editable: PropTypes.bool,
    types: PropTypes.array,
    placeholder: PropTypes.string,
    returnKeyType: PropTypes.string,
    minLength: PropTypes.number,
    containerStyle: PropTypes.object,
    inputStyle: PropTypes.object,
    resultsContainerStyle: PropTypes.object,
    externalResults: PropTypes.array,
    nearbyApiParams: PropTypes.object,
    textSearchApiParams: PropTypes.object,
    autoCompleteApiParams: PropTypes.object,
    queryAutoCompleteApiParams: PropTypes.object,
    detailApiParams: PropTypes.object
};

PlacesSearch.defaultProps = {
    onSearch: null,
    onSelect: null,
    onCancel: null,
    autoFocus: false,
    debounce: 1000,
    editable: true,
    types: [],
    placeholder: '',
    returnKeyType: 'search',
    minLength: 3,
    onSelectPlace: null,
    containerStyle: {},
    inputStyle: {},
    resultsContainerStyle: {},
    renderResultItem: null,
    resultKeyExtractor: null,
    renderListDivider: null,
    renderListEmptyComponent: null,
    renderListFooterComponent: null,
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
