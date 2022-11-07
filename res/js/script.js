// NOTICE!! DO NOT USE ANY OF THIS JAVASCRIPT
// IT'S ALL JUST JUNK FOR OUR DOCS!
// ++++++++++++++++++++++++++++++++++++++++++

!function ($) {

    $(function(){

	// Disable certain links in docs
	$('section [href^=#]').click(function (e) {
	    e.preventDefault()
	})

	// make code pretty
	window.prettyPrint && prettyPrint()

	// add-ons
	$('.add-on :checkbox').on('click', function () {
	    var $this = $(this)
            , method = $this.attr('checked') ? 'addClass' : 'removeClass'
	    $(this).parents('.add-on')[method]('active')
	})

	// position static twipsies for components page
	if ($(".twipsies a").length) {
	    $(window).on('load resize', function () {
		$(".twipsies a").each(function () {
		    $(this)
			.tooltip({
			    placement: $(this).attr('title')
			    , trigger: 'manual'
			})
			.tooltip('show')
		})
	    })
	}

	// add tipsies to grid for scaffolding
	if ($('#grid-system').length) {
	    $('#grid-system').tooltip({
		selector: '.show-grid > div'
		, title: function () { return $(this).width() + 'px' }
	    })
	}

	// fix sub nav on scroll
	var $win = $(window)
	, $nav = $('.subnav')
	, navTop = $('.subnav').length && $('.subnav').offset().top - 40
	, isFixed = 0

	processScroll()

	$win.on('scroll', processScroll)

	function processScroll() {
	    var i, scrollTop = $win.scrollTop()
	    if (scrollTop >= navTop && !isFixed) {
		isFixed = 1
		$nav.addClass('subnav-fixed')
	    } else if (scrollTop <= navTop && isFixed) {
		isFixed = 0
		$nav.removeClass('subnav-fixed')
	    }
	}

	// tooltip demo
	$('.tooltip-demo.well').tooltip({
	    selector: "a[rel=tooltip]"
	})

	$('.tooltip-test').tooltip()
	$('.popover-test').popover()

	// popover demo
	$("a[rel=popover]")
	    .popover()
	    .click(function(e) {
		e.preventDefault()
	    })

	// button state demo
	$('#fat-btn')
	    .click(function () {
		var btn = $(this)
		btn.button('loading')
		setTimeout(function () {
		    btn.button('reset')
		}, 3000)
	    })

	// carousel demo
	$('#myCarousel').carousel()

	// javascript build logic
	var inputsComponent = $("#components.download input")
	, inputsPlugin = $("#plugins.download input")
	, inputsVariables = $("#variables.download input")

	// toggle all plugin checkboxes
	$('#components.download .toggle-all').on('click', function (e) {
	    e.preventDefault()
	    inputsComponent.attr('checked', !inputsComponent.is(':checked'))
	})

	$('#plugins.download .toggle-all').on('click', function (e) {
	    e.preventDefault()
	    inputsPlugin.attr('checked', !inputsPlugin.is(':checked'))
	})

	$('#variables.download .toggle-all').on('click', function (e) {
	    e.preventDefault()
	    inputsVariables.val('')
	})

	// request built javascript
	$('.download-btn').on('click', function () {

	    var css = $("#components.download input:checked")
		.map(function () { return this.value })
		.toArray()
            , js = $("#plugins.download input:checked")
		.map(function () { return this.value })
		.toArray()
            , vars = {}
            , img = ['glyphicons-halflings.png', 'glyphicons-halflings-white.png']

	    $("#variables.download input")
		.each(function () {
		    $(this).val() && (vars[ $(this).prev().text() ] = $(this).val())
		})

	    $.ajax({
		type: 'POST'
		, url: 'http://bootstrap.herokuapp.com'
		, dataType: 'jsonpi'
		, params: {
		    js: js
		    , css: css
		    , vars: vars
		    , img: img
		}
	    })
	})

    })

    // Modified from the original jsonpi https://github.com/benvinegar/jquery-jsonpi
    $.ajaxTransport('jsonpi', function(opts, originalOptions, jqXHR) {
	var url = opts.url;

	return {
	    send: function(_, completeCallback) {
		var name = 'jQuery_iframe_' + jQuery.now()
		, iframe, form

		iframe = $('<iframe>')
		    .attr('name', name)
		    .appendTo('head')

		form = $('<form>')
		    .attr('method', opts.type) // GET or POST
		    .attr('action', url)
		    .attr('target', name)

		$.each(opts.params, function(k, v) {

		    $('<input>')
			.attr('type', 'hidden')
			.attr('name', k)
			.attr('value', typeof v == 'string' ? v : JSON.stringify(v))
			.appendTo(form)
		})

		form.appendTo('body').submit()
	    }
	}
    })

}(window.jQuery)


/**
 * Construct the module list from source.
 * The module list is located in the source
 * because it must also work with noscript.
 */
function reapModuleList() {
    var modules = new Array();

    $('#module-list-source').find('li > a').each(function() {
	modules.push($(this).text());
    });

    return modules;
}

/**
 * Build a table representing the module hierarchy of the project
 * given a linear list of modules.
 */
function buildModuleTree(modlist) {
    var root = {'members': {}};

    for (var i = 0; i < modlist.length; i++) {
	var qualifiedName = modlist[i];
	var parts = qualifiedName.split('.');

	var parent = root;
	for(var partIndex = 0; partIndex < parts.length; partIndex++) {
	    var name = parts[partIndex];
	    var node;

	    if(partIndex == parts.length - 1) {
		node = {'type': 'module', 'qualifiedName': qualifiedName};
		parent.members[name] = node;
	    } else {
		node = parent.members[name];
		if(typeof node == "undefined") {
		    node = {'type': 'package', 'members': {}};
		    parent.members[name] = node;
		}
	    }

	    parent = node;
	}
    }

    return root;
}

/**
 * Build a path to the appropriate resource for a fully qualified module name,
 * respecting the global PackageSeparator variable.
 */
function qualifiedModuleNameToUrl(modName) {
    if(PackageSeparator == '.') {
	return modName + '.html';
    } else {
	return modName.replace(/\./g, PackageSeparator) + '.html';
    }
}

/**
 * Returns a module name corresponding to the filesystem structure.
 * May differ from module <name>; decl in the module, for example for package.d modules.
 */
function currentModuleFilesystemBasedName() {
    var url = window.location.pathname;
    var filename = url.substring(url.lastIndexOf('/')+1);
    return filename.substring(0, filename.lastIndexOf('.'));
}

/**
 * Create the module list in the sidebar.
 */
function populateModuleList(modTree) {
    function treePackageNode(name) {
	return '<li class="dropdown sidebar-list-entry">' +
	    '<a class="tree-node" href="javascript:;" title="' + name + '"><i class="icon-th-list"></i> ' + name + '<b class="caret"></b></a>' +
	    '<ul class="custom-icon-list"></ul></li>';
    }

    function treeModuleNode(name, url) {
	return '<li class="sidebar-list-entry">' +
	    '<a class="tree-leaf" href="' + url + '" title="' + name + '"><i class="icon-th"></i> ' + name + '</a>' +
	    '</li>';
    }

    var $listHeader = $('#module-list');

    function traverser(node, $parentList) {
	var currentModuleName = currentModuleFilesystemBasedName();
	for(var name in node.members) {
	    var member = node.members[name];

	    if(member.type == 'package') {
		var $elem = $(treePackageNode(name));
		$parentList.append($elem);

		var $ul = $elem.find('ul');
		if($parentList != $listHeader) {
		    $ul.hide();
		}

		traverser(member, $ul);

	    } else if(member.type == 'module') {
		var url = qualifiedModuleNameToUrl(member.qualifiedName);
		var $elem = $(treeModuleNode(name, url));
		$parentList.append($elem);

		if(member.qualifiedName == currentModuleName) {
		    $elem.find('a').append(' <i class="icon-asterisk"></i>');

		    var $up = $parentList;
		    while(!$up.is($listHeader)) {
			$up.show();
			$up = $up.parent();
		    }
		}
	    }
	}
    }

    traverser(modTree, $listHeader);
}

/**
 * Build a relative path for the given module name.
 */
function moduleNameToPath(modName) {
    return modName.replace(/\./g, '/') + '.d';
}

/**
 * Configure the breadcrumb component at the top of the page
 * with the current module.
 */
function updateBreadcrumb(qualifiedName, sourceRepoUrl) {
    var $breadcrumb = $('#module-breadcrumb');

    var parts = qualifiedName.split('.');
    for(var i = 0; i < parts.length; i++) {
	var part = parts[i];

	// if(i == parts.length - 1) {
	//     var sourceUrl = sourceRepoUrl + '/' + moduleNameToPath(currentModuleFilesystemBasedName());
	//     $breadcrumb.append('<li class="active"><h2>' + part + ' <a href="' + sourceUrl + '"><small>view source</small></a></h2></li>');
	// } else {
	$breadcrumb.append('<li><h2>' + part + '<span class="divider">/</span></h2></li>');
    //}
    }
}

var enumRegex = /^enum /;
var structRegex = /^struct /;
var classRegex = /^class /;
var templateRegex = /^template /;
var functionRegex = /\);\s*$/m;
var propertyRegex = /@property/m;
var constructorRegex = /^[^(]*?this\(+/;

/**
 * Build a table out of all symbols declared in the current module.
 */
function buildSymbolTree() {
    function fillTree(parentNode, $parent) {
	$parent.children('.declaration').each(function() {
	    var $decl = $(this);
	    var text = $decl.text();

	    var $symbolLink = $decl.find('.symbol-link');
	    var $symbolTarget = $decl.find('.symbol-target');
	    
	    var symbol;
	    if($symbolLink.length == 0) { // Special member (e.g. constructor).
		if(constructorRegex.test(text)) {
		    symbol = 'this';
		}
	    } else {
		symbol = $symbolLink.html();
	    }
	    
	    function fillSubTree(type) {
		var subTree = {
		    'name': symbol,
		    'type': type,
		    'members': new Array(),
		    'decl': $decl,
		    'symbolLinkNode': $symbolLink,
		    'symbolTargetNode': $symbolTarget
		};

		parentNode.push(subTree);
		fillTree(subTree.members, $decl.next('.declaration-content').children('.member-list'));
	    }

	    function addLeaf(type) {
		var leaf = {
		    'name': symbol,
		    'type': type,
		    'decl': $decl,
		    'symbolLinkNode': $symbolLink,
		    'symbolTargetNode': $symbolTarget
		};

		parentNode.push(leaf);
	    }
	    
	    if(symbol == 'this') {
		addLeaf('constructor');
	    } else if(enumRegex.test(text)) {
		fillSubTree('enum');
	    } else if(structRegex.test(text)) {
		fillSubTree('struct');
	    } else if(classRegex.test(text)) {
		fillSubTree('class');
	    } else if(templateRegex.test(text)) {
		fillSubTree('template');
	    } else if(functionRegex.test(text)) {
		if(propertyRegex.test(text)) {
		    addLeaf('property');
		} else {
		    addLeaf('function');
		}
	    } else {
		addLeaf('variable');
	    }
	});
    }

    var $declRoot = $('#declaration-list');
    var tree = new Array();

    fillTree(tree, $declRoot);

    return tree;
}

/**
 * Create the symbol list in the sidebar.
 * Returns an array of the anchor names for the symbols in the list.
 */
function populateSymbolList(tree) {
    function expandableNode(name, anchor, type) {
	return '<li class="dropdown sidebar-list-entry"><span>' +
	    '<i class="ddoc-icon-' + type + '"></i><a class="symbol-link" href="#' + anchor + '" title="' + name + '">' + name + '</a>' +
	    '</span><ul class="custom-icon-list"></ul></li>';
    }

    function leafNode(name, anchor, type) {
	return '<li class="sidebar-list-entry"><span><i class="ddoc-icon-' + type + '"></i><a class="symbol-link" href="#' + anchor + '" title="' + name + '">' + name + '</a></span></li>';
    }

    var anchorNames = new Array();

    function traverser(parent, $parent, anchorTail) {
	for(var i = 0; i < parent.length; i++) {
	    var node = parent[i];
	    var isTree = typeof node.members !== 'undefined';
	    var anchorName = anchorTail + node.name;
	    anchorNames.push(anchorName);

	    if(node.type == 'constructor') { // Constructor fixup.
		var $decl = node.decl;

		// Bare DDOC_PSYMBOL
		var symbolTemplate = '<span class="symbol-target">&nbsp;</span><a class="symbol-link">this</a>';

		var fixedSymbol = $decl.html().replace(/this/, symbolTemplate);
		$decl.html(fixedSymbol);

		node.symbolTargetNode = $decl.find('.symbol-target');
		node.symbolLinkNode = $decl.find('.symbol-link');
		
		node.type = 'function'; // Use the same list icon as functions.
	    }

	    node.symbolTargetNode.attr('id', anchorName);
	    node.symbolLinkNode.attr('href', '#' + anchorName);

	    if(isTree) {
		var $node = $(expandableNode(node.name, anchorName, node.type));
		$parent.append($node);

		if(node.members.length > 0) {
		    var $caret = $('<b class="caret tree-node-standalone"></b>');
		    $node.find('span').append($caret);
		}

		var $list = $node.find('ul');
		$list.attr('id', anchorName + '_member-list');
		$list.hide(); // Default to closed.
		traverser(node.members, $list, anchorName + '.');
	    } else {
		var $node = $(leafNode(node.name, anchorName, node.type));
		$parent.append($node);
	    }
	}
    }

    var $symbolHeader = $('#symbol-list');
    $symbolHeader.removeClass('hidden');

    traverser(tree, $symbolHeader.parent(), '');

    return anchorNames;
}

/**
 * Set the current symbol to highlight.
 */
function highlightSymbol(targetId) {
    function escapeId(id) {
	return id.replace(/\./g, '\\.');
    }

    var $target = $(escapeId(targetId)).parent();

    if(window.currentlyHighlightedSymbol) {
	window.currentlyHighlightedSymbol.removeClass('highlighted-symbol');
    }

    $target.addClass('highlighted-symbol');

    window.currentlyHighlightedSymbol = $target;

    // Open symbol list down to highlighted symbol.
    function eatHead(name) {
	var i = name.lastIndexOf('.');
	if(i != -1) {
	    return name.slice(0, i);
	}
    }

    var nodeName = eatHead(targetId);
    while(typeof nodeName !== 'undefined') {
	$(escapeId(nodeName) + '_member-list').show();
	nodeName = eatHead(nodeName);
    }
}

/**
 * Configure the goto-symbol search form in the titlebar.
 */
function setupGotoSymbolForm(typeaheadData) {
    var $form = $('#gotosymbol');
    var $input = $form.children('input');

    function go(target) {
	window.location.hash = target;
	highlightSymbol('#' + target);
	$input.blur();
    }

    $form.submit(function(event) {
	event.preventDefault();

	go($input.val());

	$input.val('');
    });

    $input.typeahead({
	'source': typeaheadData,
	'updater': function(item) {
	    go(item);
	    return '';
	}
    });

    $form.removeClass('hidden');
}

// 'Title' and 'SourceRepository' are created inline in the DDoc generated HTML page.
$(document).ready(function() {

    // Construct module list.
    populateModuleList(buildModuleTree(reapModuleList()));

    // Construct symbol list and setup goto-symbol form.
    var symbolTree = buildSymbolTree();
    if(symbolTree.length > 0) {
	var symbolAnchors = populateSymbolList(symbolTree);
	setupGotoSymbolForm(symbolAnchors);
    }

    // Setup symbol anchor highlighting.
    $('.symbol-link').click(function() {
	var targetId = $(this).attr('href');
	highlightSymbol(targetId);
    });

    if(document.location.hash.length > 0) {
	highlightSymbol(document.location.hash);
    }

    // Setup collapsable tree nodes.
    function treeNodeClick() {
	$(this).parent().children('ul').toggle();
    }

    function standaloneNodeClick() {
	$(this).parent().parent().children('ul').toggle();
    }

    var $treeNodes = $('.tree-node');
    var $standaloneTreeNodes = $('.tree-node-standalone');

    $treeNodes.click(treeNodeClick);
    $standaloneTreeNodes.click(standaloneNodeClick);
});
