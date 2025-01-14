var onRun = function(context) {

    var ga = require("../modules/Google_Analytics");
    ga("Layer");

    var preferences = require("../modules/Preferences");
    var boundsLayerName = "#";

    var doc = context.document;
    var selection = context.selection;
    if (selection.count() > 0) {

        var defaultUserInputString = preferences.get("boundsSize") || "0";

        // \d+, \d+x\d+
        var userInputString;
        var version = require("sketch").version.sketch;
        var UI = require("sketch/ui");
        if (version >= 53) {
            UI.getInputFromUser(
                "Bounds Layer for Every Selection",
                {
                    initialValue: defaultUserInputString,
                    description: "Input <Number> or <Width>x<Height>. use \"0\" for same size as selected layer."
                },
                function (err, value) {
                  if (err) return;
                  userInputString = value;
                }
            );
        } else {
            userInputString = doc.askForUserInput_initialValue("Input <Number> or <Width>x<Height>.", defaultUserInputString);
        }

        if (userInputString) {

            if (!/^\d+$/.test(userInputString) && !/^\d+x\d+$/.test(userInputString)) {
                doc.showMessage("Bad input format.");
                return;
            }

            preferences.set("boundsSize", userInputString.toString());

            var loop = selection.objectEnumerator();
            while (layer = loop.nextObject()) {

                // var originalBounds = layer.rect();
                // Round to pixel
                var originalBounds = CGRectMake(
                    Math.floor(layer.frame().x()),
                    Math.floor(layer.frame().y()),
                    Math.ceil(layer.frame().maxX()) - Math.floor(layer.frame().minX()),
                    Math.ceil(layer.frame().maxY()) - Math.floor(layer.frame().minY())
                );

                var parent = layer.parentGroup();
                var beforeLayer = layer;

                var boundsOffsetLeft = boundsOffsetTop = 0;

                if (/^\d+$/.test(userInputString)) {
                    boundsOffsetLeft = boundsOffsetTop = parseInt(userInputString);
                }

                var boundsLayerX = originalBounds.origin.x - boundsOffsetLeft,
                    boundsLayerY = originalBounds.origin.y - boundsOffsetTop,
                    boundsLayerWidth = originalBounds.size.width + boundsOffsetLeft * 2,
                    boundsLayerHeight = originalBounds.size.height + boundsOffsetTop * 2;

                if (/^\d+x\d+$/.test(userInputString)) {
                    var userCustomWidth = parseInt(/(\d+)/.exec(userInputString)[1]);
                    var userCustomHeight = parseInt(/x(\d+)/.exec(userInputString)[1]);
                    boundsOffsetLeft = Math.floor((userCustomWidth - Math.ceil(originalBounds.size.width)) / 2);
                    boundsOffsetTop = Math.floor((userCustomHeight - Math.ceil(originalBounds.size.height)) / 2);
                    boundsLayerX = originalBounds.origin.x - boundsOffsetLeft;
                    boundsLayerY = originalBounds.origin.y - boundsOffsetTop;
                    boundsLayerWidth = userCustomWidth;
                    boundsLayerHeight = userCustomHeight;
                }

                if (layer.class() == "MSLayerGroup" || layer.class() == "MSArtboardGroup") {
                    parent = layer;
                    beforeLayer = layer.firstLayer();
                    boundsLayerX = 0 - layer.frame().x() + Math.floor(layer.frame().x()) - boundsOffsetLeft;
                    boundsLayerY = 0 - layer.frame().y() + Math.floor(layer.frame().y()) - boundsOffsetTop;
                }

                // Add bounds layer
                var newBounds = CGRectMake(boundsLayerX, boundsLayerY, boundsLayerWidth, boundsLayerHeight);
                var rectangle = MSRectangleShape.alloc().init();
                rectangle.setRect(newBounds);

                var boundsLayer;
                if (MSApplicationMetadata.metadata().appVersion >= 52) {
                    boundsLayer = rectangle;
                } else {
                    boundsLayer = MSShapeGroup.shapeWithPath(rectangle);
                }
                boundsLayer.setName(boundsLayerName);
                parent.insertLayer_beforeLayer(boundsLayer, beforeLayer);

                // Select boundsLayer
                if (boundsLayer.parentGroup() != layer){
                    // Fix Sketch 45
                    if (MSApplicationMetadata.metadata().appVersion < 45) {
                        boundsLayer.select_byExpandingSelection(true, false);
                    } else {
                        boundsLayer.select_byExtendingSelection(true, false);
                    }
                }

                // Artboard
                if (layer.class() == "MSArtboardGroup") {
                    layer.frame().setX(layer.frame().x() - boundsOffsetLeft);
                    layer.frame().setY(layer.frame().y() - boundsOffsetTop);
                    layer.frame().setWidth(boundsLayerWidth);
                    layer.frame().setHeight(boundsLayerHeight);
                    for (var i = 0; i < layer.layers().count(); i++) {
                        var childLayer = layer.layers().objectAtIndex(i);
                        childLayer.frame().setX(childLayer.frame().x() + boundsOffsetLeft);
                        childLayer.frame().setY(childLayer.frame().y() + boundsOffsetTop)
                    }
                }

                // Fix layer group bounds
                if (layer.class() == "MSLayerGroup") {
                    // reset bounds
                    if (MSApplicationMetadata.metadata().appVersion >= 53) {
                        layer.fixGeometryWithOptions(1);
                    } else {
                        layer.resizeToFitChildrenWithOption(1);
                    }
                    // Round to pixel
                    if (
                        layer.frame().x() - Math.floor(layer.frame().x()) != 0 ||
                        layer.frame().y() - Math.floor(layer.frame().y()) != 0 ||
                        layer.frame().maxX() - Math.floor(layer.frame().maxX()) != 0 ||
                        layer.frame().maxY() - Math.floor(layer.frame().maxY()) != 0
                    ) {
                        var childs = MSLayerArray.arrayWithLayers(layer.containedLayers());
                        var name = layer.name();
                        layer.ungroup();
                        var newGroup;
                        if (MSApplicationMetadata.metadata().appVersion >= 52) {
                            newGroup = MSLayerGroup.groupWithLayers(childs);
                        } else {
                            newGroup = MSLayerGroup.groupFromLayers(childs);
                        }
                        newGroup.setName(name);
                    }
                }

            }

        }

    } else {
        doc.showMessage("Please select at least 1 layer.");
    }

};
