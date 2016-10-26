/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
const assign = require('object-assign');
import classnames from 'classnames';
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {changeLayerProperties} = require('../../MapStore2/web/client/actions/layers')
const {toggleLayertree} = require('../actions/layertree');
const UrlParams = require("../utils/UrlParams");
const LayerUtils = require('../utils/LayerUtils');
require('./style/LayerTree.css');


const LayerTree = React.createClass({
    propTypes: {
        layers: React.PropTypes.array,
        expanded: React.PropTypes.bool,
        changeLayerProperties: React.PropTypes.func,
        toggleLayertree: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            layers: [],
            visible: false,
        };
    },
    getInitialState: function() {
        return {activemenu: null};
    },
    getLegendGraphicURL(layer, sublayer) {
        if(layer.type !== "wms") {
            return "";
        }
        return layer.url + "?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=" + sublayer.name;
    },
    getGroupVisibility(group) {
        if(!group.sublayers || group.sublayers.length === 0) {
            return 1;
        }
        let visible = 0;
        group.sublayers.map(sublayer => {
            if(sublayer.sublayers) {
                visible += this.getGroupVisibility(sublayer);
            } else {
                visible += sublayer.visibility ? 1 : 0;
            }
        });
        return visible / group.sublayers.length;
    },
    renderLayerGroup(layer, group, path) {
        let visibility = this.getGroupVisibility(group);
        let checkclasses = classnames({
            "layertree-item-checkbox": true,
            "layertree-item-checkbox-unchecked": visibility === 0,
            "layertree-item-checkbox-checked": visibility === 1,
            "layertree-item-checkbox-tristate": visibility > 0 && visibility < 1,
        });
        let sublayersContent = null;
        if(visibility > 0 && group.sublayers) {
            sublayersContent = (
                <ul>
                    {group.sublayers.map((sublayer, idx) => {
                        let subpath = [...path, idx];
                        if(sublayer.sublayers) {
                            return this.renderLayerGroup(layer, sublayer, subpath)
                        } else {
                            return this.renderSubLayer(layer, sublayer, subpath);
                        }

                    })}
                </ul>);
        }
        return (
            <ul key={group.name}>
                <li><span className={checkclasses} onClick={() => this.groupToggled(layer, path, visibility)}></span> {group.title}
                    {sublayersContent}
                </li>
            </ul>
        )
    },
    renderSubLayer(layer, sublayer, path) {
        let pathstr = layer.id + "/" + path.join("/");
        let checkclasses = classnames({
            "layertree-item-checkbox": true,
            "layertree-item-checkbox-unchecked": !sublayer.visibility,
            "layertree-item-checkbox-checked": sublayer.visibility,
        });
        let editclasses = classnames({
            "layertree-item-edit": true,
            "layertree-item-edit-active": this.state.activemenu === pathstr
        })
        return (
            <li className="layertree-item" key={sublayer.name}>
                <span className={checkclasses} onClick={() => this.sublayerToggled(layer, path)}></span>
                <span className="layertree-item-legend">
                    <img className="layertree-item-legend-tooltip" src={this.getLegendGraphicURL(layer, sublayer)} />
                    <img className="layertree-item-legend-thumbnail" src={this.getLegendGraphicURL(layer, sublayer)} />
                </span>
                <span className="layertree-item-title">{sublayer.title}</span>
                {sublayer.queryable ? (<Glyphicon className="layertree-item-queryable" glyph="info-sign" />) : null}
                <span className={editclasses}>
                    <Glyphicon glyph="cog" onClick={() => this.sublayerMenuToggled(pathstr)}/>
                    <ul className="layertree-item-edit-menu">
                        <li>
                            <span><Message msgId="layertree.transparency" /></span>
                            <input type="range" min="0" max="255" step="1" defaultValue={255-sublayer.opacity} onMouseUp={(ev) => this.sublayerTransparencyChanged(layer, path, ev.target.value)} />
                        </li>
                    </ul>
                </span>
            </li>
        )
    },
    renderLayerTree(layer) {
        return layer.group === 'background' ? null: this.renderLayerGroup(layer, layer, []);
    },
    render() {
        let expanderIcon = this.props.expanded ? 'triangle-left' : 'triangle-right';
        let expandedClass = this.props.expanded ? 'expanded' : 'collapsed';
        return (
            <div id="LayerTree" className={expandedClass}>
                <div className="layertree-container">{this.props.layers.map(this.renderLayerTree)}</div>
                <div className="layertree-expander"><div><Glyphicon glyph={expanderIcon} onClick={this.layerTreeVisibilityToggled}/></div></div>
            </div>
        );
    },
    layerTreeVisibilityToggled() {
        this.props.toggleLayertree(!this.props.expanded);
    },
    cloneLayerTree(layer, sublayerpath)
    {
        let newlayer = assign({}, layer);
        let cur = newlayer;
        for(let i = 0; i < sublayerpath.length; ++i) {
            let idx = sublayerpath[i];
            cur.sublayers = [
                ...cur.sublayers.slice(0, idx),
                assign({}, cur.sublayers[idx]),
                ...cur.sublayers.slice(idx + 1)];
            cur = cur.sublayers[idx];
        }
        return {newlayer, newsublayer: cur};
    },
    groupToggled(layer, path, oldvisibility) {
        if(path.length === 0) {
            // Toggle entire layer
            let newlayerprops = assign({}, layer, {visibility: !layer.visibility});
            this.props.changeLayerProperties(layer.id, newlayerprops);
        } else {
            // TODO: Toggle group children

        }
    },
    sublayerToggled(layer, sublayerpath) {
        let {newlayer, newsublayer} = this.cloneLayerTree(layer, sublayerpath);
        newsublayer.visibility = !newsublayer.visibility;
        let newparams = LayerUtils.buildLayerParams(newlayer.sublayers);
        assign(newlayer, {params: newparams});
        UrlParams.updateParams({l: newparams.LAYERS});
        this.props.changeLayerProperties(layer.id, newlayer);
    },
    sublayerTransparencyChanged(layer, sublayerpath, value) {
        let {newlayer, newsublayer} = this.cloneLayerTree(layer, sublayerpath);
        newsublayer.opacity = 255 - value;
        assign(newlayer, {params: LayerUtils.buildLayerParams(newlayer.sublayers)});
        this.props.changeLayerProperties(layer.id, newlayer);
    },
    sublayerMenuToggled(sublayerpath) {
        this.setState({activemenu: this.state.activemenu === sublayerpath ? null : sublayerpath});
    }
});

const selector = (state) => ({
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    expanded: state.layertree ? state.layertree.expanded : true
});

module.exports = {
    LayerTreePlugin: connect(selector, {
        changeLayerProperties: changeLayerProperties,
        toggleLayertree: toggleLayertree
    })(LayerTree),
    reducers: {
        layers: require('../../MapStore2/web/client/reducers/layers'),
        layertree: require('../reducers/layertree')
    }
};
